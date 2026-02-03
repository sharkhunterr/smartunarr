"""AIProfileService for generating profiles using Ollama."""

import json
import logging
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any
from uuid import uuid4

from app.adapters.ollama_adapter import OllamaAdapter
from app.services.ai_prompt_template import (
    SYSTEM_PROMPT,
    get_generation_prompt,
    get_modification_prompt,
    get_recommended_model,
    get_refinement_prompt,
)

logger = logging.getLogger(__name__)


@dataclass
class GenerationAttempt:
    """Record of a generation attempt."""

    attempt_number: int
    prompt: str
    response: str | None
    parsed_json: dict[str, Any] | None
    validation_errors: list[str]
    success: bool
    timestamp: datetime = field(default_factory=datetime.utcnow)


@dataclass
class GenerationResult:
    """Result of profile generation."""

    success: bool
    profile: dict[str, Any] | None
    attempts: list[GenerationAttempt]
    total_attempts: int
    error_message: str | None = None
    generation_id: str = field(default_factory=lambda: str(uuid4()))


class AIProfileService:
    """Service for AI-assisted profile generation."""

    MAX_ATTEMPTS = 3
    DEFAULT_MODEL = "llama3.1:8b"

    def __init__(
        self,
        ollama_url: str = "http://localhost:11434",
        model: str | None = None,
    ) -> None:
        """
        Initialize AI profile service.

        Args:
            ollama_url: Ollama server URL
            model: Model to use (default: recommended model)
        """
        self.adapter = OllamaAdapter(ollama_url)
        self.model = model or get_recommended_model("profile_generation")
        self._generation_history: list[GenerationResult] = []

    async def close(self) -> None:
        """Close the adapter connection."""
        await self.adapter.close()

    async def generate_profile(
        self,
        user_request: str,
        available_libraries: list[dict[str, Any]] | None = None,
        temperature: float = 0.3,
    ) -> GenerationResult:
        """
        Generate a profile from a natural language request.

        Uses a 3-attempt retry logic:
        1. First attempt with original prompt
        2. If validation fails, retry with refinement prompt including errors
        3. Final attempt with more explicit instructions

        Args:
            user_request: User's natural language description
            available_libraries: Optional list of available Plex libraries
            temperature: Generation temperature (lower = more deterministic)

        Returns:
            GenerationResult with profile or error details
        """
        attempts: list[GenerationAttempt] = []
        current_profile: dict[str, Any] | None = None
        current_errors: list[str] = []

        for attempt_num in range(1, self.MAX_ATTEMPTS + 1):
            logger.info(
                f"Generation attempt {attempt_num}/{self.MAX_ATTEMPTS} with model '{self.model}'"
            )

            # Build prompt based on attempt
            if attempt_num == 1:
                prompt = get_generation_prompt(user_request, available_libraries)
            else:
                if current_profile:
                    prompt = get_refinement_prompt(
                        current_profile,
                        current_errors,
                        attempt_num,
                    )
                else:
                    # If we don't have a profile yet, retry with original prompt
                    prompt = get_generation_prompt(user_request, available_libraries)

            # Generate response
            # Note: format_json=False because some models (qwen3) don't work well with it
            # The prompt already instructs the model to output JSON only
            logger.info("Waiting for Ollama response (this may take several minutes)...")
            response = await self.adapter.generate(
                model=self.model,
                prompt=prompt,
                system=SYSTEM_PROMPT,
                temperature=temperature,
                format_json=False,
            )

            if not response:
                logger.warning("No response received from Ollama")
                attempt = GenerationAttempt(
                    attempt_number=attempt_num,
                    prompt=prompt,
                    response=None,
                    parsed_json=None,
                    validation_errors=["No response from Ollama"],
                    success=False,
                )
                attempts.append(attempt)
                continue

            # Parse JSON
            logger.info(f"Received response ({len(response)} chars), parsing JSON...")
            if len(response) < 100:
                logger.warning(f"Short response content: {response[:200]!r}")
            parsed_profile = self._parse_json_response(response)

            if parsed_profile is None:
                logger.warning(f"Failed to parse JSON from response: {response[:500]!r}")
                attempt = GenerationAttempt(
                    attempt_number=attempt_num,
                    prompt=prompt,
                    response=response,
                    parsed_json=None,
                    validation_errors=["Failed to parse JSON response"],
                    success=False,
                )
                attempts.append(attempt)
                current_errors = [
                    "La réponse n'est pas un JSON valide. Assure-toi de générer uniquement du JSON."
                ]
                continue

            # Validate profile
            logger.info("Validating generated profile...")
            validation_errors = self._validate_profile(parsed_profile)

            if not validation_errors:
                # Success!
                logger.info("Profile generated and validated successfully!")
                attempt = GenerationAttempt(
                    attempt_number=attempt_num,
                    prompt=prompt,
                    response=response,
                    parsed_json=parsed_profile,
                    validation_errors=[],
                    success=True,
                )
                attempts.append(attempt)

                result = GenerationResult(
                    success=True,
                    profile=parsed_profile,
                    attempts=attempts,
                    total_attempts=attempt_num,
                )
                self._generation_history.append(result)
                return result

            # Validation failed
            attempt = GenerationAttempt(
                attempt_number=attempt_num,
                prompt=prompt,
                response=response,
                parsed_json=parsed_profile,
                validation_errors=validation_errors,
                success=False,
            )
            attempts.append(attempt)

            current_profile = parsed_profile
            current_errors = validation_errors

        # All attempts failed
        result = GenerationResult(
            success=False,
            profile=current_profile,  # Return best effort
            attempts=attempts,
            total_attempts=self.MAX_ATTEMPTS,
            error_message=f"Failed to generate valid profile after {self.MAX_ATTEMPTS} attempts. Last errors: {', '.join(current_errors)}",
        )
        self._generation_history.append(result)
        return result

    async def modify_profile(
        self,
        current_profile: dict[str, Any],
        modification_request: str,
        temperature: float = 0.2,
    ) -> GenerationResult:
        """
        Modify an existing profile based on a request.

        Args:
            current_profile: The profile to modify
            modification_request: What to change
            temperature: Generation temperature

        Returns:
            GenerationResult with modified profile
        """
        attempts: list[GenerationAttempt] = []

        prompt = get_modification_prompt(current_profile, modification_request)

        for attempt_num in range(1, self.MAX_ATTEMPTS + 1):
            response = await self.adapter.generate(
                model=self.model,
                prompt=prompt,
                system=SYSTEM_PROMPT,
                temperature=temperature,
                format_json=False,  # Disabled for compatibility with qwen3 and similar models
            )

            if not response:
                attempt = GenerationAttempt(
                    attempt_number=attempt_num,
                    prompt=prompt,
                    response=None,
                    parsed_json=None,
                    validation_errors=["No response from Ollama"],
                    success=False,
                )
                attempts.append(attempt)
                continue

            parsed_profile = self._parse_json_response(response)

            if not parsed_profile:
                attempt = GenerationAttempt(
                    attempt_number=attempt_num,
                    prompt=prompt,
                    response=response,
                    parsed_json=None,
                    validation_errors=["Failed to parse JSON response"],
                    success=False,
                )
                attempts.append(attempt)
                continue

            validation_errors = self._validate_profile(parsed_profile)

            if not validation_errors:
                attempt = GenerationAttempt(
                    attempt_number=attempt_num,
                    prompt=prompt,
                    response=response,
                    parsed_json=parsed_profile,
                    validation_errors=[],
                    success=True,
                )
                attempts.append(attempt)

                return GenerationResult(
                    success=True,
                    profile=parsed_profile,
                    attempts=attempts,
                    total_attempts=attempt_num,
                )

            # Build refinement prompt for next attempt
            prompt = get_refinement_prompt(parsed_profile, validation_errors, attempt_num + 1)

            attempt = GenerationAttempt(
                attempt_number=attempt_num,
                prompt=prompt,
                response=response,
                parsed_json=parsed_profile,
                validation_errors=validation_errors,
                success=False,
            )
            attempts.append(attempt)

        return GenerationResult(
            success=False,
            profile=None,
            attempts=attempts,
            total_attempts=self.MAX_ATTEMPTS,
            error_message="Failed to modify profile",
        )

    def _parse_json_response(self, response: str) -> dict[str, Any] | None:
        """
        Parse JSON from response, handling common issues.

        Args:
            response: Raw response string

        Returns:
            Parsed dictionary or None
        """
        try:
            return json.loads(response)
        except json.JSONDecodeError:
            pass

        # Try to extract JSON from response
        try:
            # Find JSON object
            start = response.find("{")
            end = response.rfind("}") + 1
            if start != -1 and end > start:
                json_str = response[start:end]
                return json.loads(json_str)
        except Exception:
            pass

        # Try to fix common issues
        try:
            # Remove markdown code blocks
            cleaned = response
            if "```json" in cleaned:
                cleaned = cleaned.split("```json")[1]
            if "```" in cleaned:
                cleaned = cleaned.split("```")[0]
            cleaned = cleaned.strip()
            return json.loads(cleaned)
        except Exception:
            pass

        return None

    def _validate_profile(self, profile: dict[str, Any]) -> list[str]:
        """
        Validate a generated profile.

        Args:
            profile: Profile dictionary to validate

        Returns:
            List of validation error messages (empty if valid)
        """
        errors = []

        # Required fields
        if not profile.get("name"):
            errors.append("Missing required field: name")

        if not profile.get("time_blocks"):
            errors.append("Missing required field: time_blocks")
        elif not isinstance(profile["time_blocks"], list):
            errors.append("time_blocks must be an array")
        elif len(profile["time_blocks"]) == 0:
            errors.append("time_blocks cannot be empty")
        else:
            # Validate each time block
            for i, block in enumerate(profile["time_blocks"]):
                block_errors = self._validate_time_block(block, i)
                errors.extend(block_errors)

        # Validate scoring_weights if present
        if "scoring_weights" in profile:
            if not isinstance(profile["scoring_weights"], dict):
                errors.append("scoring_weights must be an object")
            else:
                valid_weights = {
                    "type",
                    "duration",
                    "genre",
                    "timing",
                    "strategy",
                    "age",
                    "rating",
                    "filter",
                    "bonus",
                }
                for key, value in profile["scoring_weights"].items():
                    if key not in valid_weights:
                        errors.append(f"Invalid scoring weight key: {key}")
                    if not isinstance(value, (int, float)):
                        errors.append(f"Scoring weight '{key}' must be a number")

        # Validate forbidden rules if present
        if "forbidden" in profile:
            if not isinstance(profile["forbidden"], list):
                errors.append("forbidden must be an array")
            else:
                for i, rule in enumerate(profile["forbidden"]):
                    rule_errors = self._validate_rule(rule, f"forbidden[{i}]")
                    errors.extend(rule_errors)

        # Validate mandatory rules if present
        if "mandatory" in profile:
            if not isinstance(profile["mandatory"], list):
                errors.append("mandatory must be an array")
            else:
                for i, rule in enumerate(profile["mandatory"]):
                    rule_errors = self._validate_rule(rule, f"mandatory[{i}]")
                    errors.extend(rule_errors)

        return errors

    def _validate_time_block(self, block: dict[str, Any], index: int) -> list[str]:
        """Validate a single time block."""
        errors = []
        prefix = f"time_blocks[{index}]"

        if not block.get("name"):
            errors.append(f"{prefix}: missing name")

        if not block.get("start_time"):
            errors.append(f"{prefix}: missing start_time")
        elif not self._is_valid_time(block["start_time"]):
            errors.append(f"{prefix}: invalid start_time format (expected HH:MM)")

        if not block.get("end_time"):
            errors.append(f"{prefix}: missing end_time")
        elif not self._is_valid_time(block["end_time"]):
            errors.append(f"{prefix}: invalid end_time format (expected HH:MM)")

        return errors

    def _validate_rule(self, rule: dict[str, Any], prefix: str) -> list[str]:
        """Validate a forbidden/mandatory rule."""
        errors = []

        valid_fields = {
            "genre",
            "content_type",
            "age_rating",
            "tmdb_rating",
            "year",
            "studio",
            "keyword",
            "duration",
        }
        valid_operators = {"equals", "not_equals", "contains", "not_contains", ">=", "<=", ">", "<"}

        if not rule.get("field"):
            errors.append(f"{prefix}: missing field")
        elif rule["field"] not in valid_fields:
            errors.append(
                f"{prefix}: invalid field '{rule['field']}', must be one of {valid_fields}"
            )

        if not rule.get("operator"):
            errors.append(f"{prefix}: missing operator")
        elif rule["operator"] not in valid_operators:
            errors.append(
                f"{prefix}: invalid operator '{rule['operator']}', must be one of {valid_operators}"
            )

        if "value" not in rule:
            errors.append(f"{prefix}: missing value")

        return errors

    def _is_valid_time(self, time_str: str) -> bool:
        """Check if a time string is valid HH:MM format."""
        try:
            parts = time_str.split(":")
            if len(parts) != 2:
                return False
            hour, minute = int(parts[0]), int(parts[1])
            return 0 <= hour <= 23 and 0 <= minute <= 59
        except Exception:
            return False

    def get_generation_history(self, limit: int = 10) -> list[GenerationResult]:
        """
        Get recent generation history.

        Args:
            limit: Maximum number of results

        Returns:
            List of recent generation results
        """
        return self._generation_history[-limit:]

    async def check_model_available(self) -> tuple[bool, str]:
        """
        Check if the configured model is available.

        Returns:
            (available, message) tuple
        """
        models = await self.adapter.list_models()
        model_names = [m.get("name", "") for m in models]

        # Check exact match
        if self.model in model_names:
            return True, f"Model {self.model} is available"

        # Check partial match (e.g., "llama3.1:8b" in "llama3.1:8b-instruct-fp16")
        for name in model_names:
            if self.model.split(":")[0] in name:
                return True, f"Model variant {name} found for {self.model}"

        return False, f"Model {self.model} not found. Available: {', '.join(model_names[:5])}"
