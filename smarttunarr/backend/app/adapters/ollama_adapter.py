"""OllamaAdapter for AI profile generation using ollama-python SDK."""

import json
import logging
from typing import Any

import httpx

logger = logging.getLogger(__name__)


class OllamaAdapter:
    """Adapter for Ollama API interactions."""

    def __init__(self, url: str = "http://localhost:11434") -> None:
        """
        Initialize Ollama adapter.

        Args:
            url: Ollama server URL
        """
        self.url = url.rstrip("/")
        self._client: httpx.AsyncClient | None = None

    async def _get_client(self) -> httpx.AsyncClient:
        """Get or create HTTP client."""
        if self._client is None:
            self._client = httpx.AsyncClient(
                base_url=self.url,
                timeout=120.0,  # Long timeout for generation
            )
        return self._client

    async def close(self) -> None:
        """Close HTTP client."""
        if self._client:
            await self._client.aclose()
            self._client = None

    async def test_connection(self) -> tuple[bool, str]:
        """
        Test connection to Ollama server.

        Returns:
            (success, message) tuple
        """
        try:
            client = await self._get_client()
            response = await client.get("/api/tags")
            if response.status_code == 200:
                data = response.json()
                models = data.get("models", [])
                return True, f"Connected to Ollama ({len(models)} models available)"
            return False, f"Ollama returned status {response.status_code}"
        except Exception as e:
            return False, f"Connection error: {str(e)}"

    async def list_models(self) -> list[dict[str, Any]]:
        """
        List available models.

        Returns:
            List of model dictionaries
        """
        try:
            client = await self._get_client()
            response = await client.get("/api/tags")
            if response.status_code == 200:
                data = response.json()
                return data.get("models", [])
            return []
        except Exception as e:
            logger.error(f"Failed to list models: {e}")
            return []

    async def generate(
        self,
        model: str,
        prompt: str,
        system: str | None = None,
        temperature: float = 0.7,
        max_tokens: int = 4096,
        format_json: bool = False,
    ) -> str | None:
        """
        Generate text using Ollama.

        Args:
            model: Model name to use
            prompt: User prompt
            system: Optional system prompt
            temperature: Generation temperature (0-1)
            max_tokens: Maximum tokens to generate
            format_json: Request JSON-formatted response

        Returns:
            Generated text or None on error
        """
        try:
            client = await self._get_client()

            payload: dict[str, Any] = {
                "model": model,
                "prompt": prompt,
                "stream": False,
                "options": {
                    "temperature": temperature,
                    "num_predict": max_tokens,
                },
            }

            if system:
                payload["system"] = system

            if format_json:
                payload["format"] = "json"

            logger.debug(f"Generating with model {model}, prompt length: {len(prompt)}")

            response = await client.post("/api/generate", json=payload)

            if response.status_code == 200:
                data = response.json()
                return data.get("response", "")
            else:
                logger.error(f"Generation failed: {response.status_code} - {response.text}")
                return None

        except Exception as e:
            logger.error(f"Generation error: {e}")
            return None

    async def chat(
        self,
        model: str,
        messages: list[dict[str, str]],
        temperature: float = 0.7,
        max_tokens: int = 4096,
        format_json: bool = False,
    ) -> str | None:
        """
        Chat with Ollama using message format.

        Args:
            model: Model name to use
            messages: List of messages with 'role' and 'content'
            temperature: Generation temperature (0-1)
            max_tokens: Maximum tokens to generate
            format_json: Request JSON-formatted response

        Returns:
            Assistant response or None on error
        """
        try:
            client = await self._get_client()

            payload: dict[str, Any] = {
                "model": model,
                "messages": messages,
                "stream": False,
                "options": {
                    "temperature": temperature,
                    "num_predict": max_tokens,
                },
            }

            if format_json:
                payload["format"] = "json"

            logger.debug(f"Chat with model {model}, {len(messages)} messages")

            response = await client.post("/api/chat", json=payload)

            if response.status_code == 200:
                data = response.json()
                message = data.get("message", {})
                return message.get("content", "")
            else:
                logger.error(f"Chat failed: {response.status_code} - {response.text}")
                return None

        except Exception as e:
            logger.error(f"Chat error: {e}")
            return None

    async def generate_json(
        self,
        model: str,
        prompt: str,
        system: str | None = None,
        temperature: float = 0.3,
    ) -> dict[str, Any] | None:
        """
        Generate JSON response from Ollama.

        Args:
            model: Model name to use
            prompt: User prompt
            system: Optional system prompt
            temperature: Generation temperature (lower for more deterministic)

        Returns:
            Parsed JSON dictionary or None on error
        """
        response = await self.generate(
            model=model,
            prompt=prompt,
            system=system,
            temperature=temperature,
            format_json=True,
        )

        if not response:
            return None

        try:
            # Try to parse the response as JSON
            return json.loads(response)
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse JSON response: {e}")

            # Try to extract JSON from the response
            try:
                # Find JSON object in response
                start = response.find("{")
                end = response.rfind("}") + 1
                if start != -1 and end > start:
                    json_str = response[start:end]
                    return json.loads(json_str)
            except Exception:
                pass

            return None

    async def get_model_info(self, model: str) -> dict[str, Any] | None:
        """
        Get information about a specific model.

        Args:
            model: Model name

        Returns:
            Model info dictionary or None
        """
        try:
            client = await self._get_client()
            response = await client.post("/api/show", json={"name": model})

            if response.status_code == 200:
                return response.json()
            return None
        except Exception as e:
            logger.error(f"Failed to get model info: {e}")
            return None

    async def pull_model(self, model: str) -> bool:
        """
        Pull a model from Ollama registry.

        Args:
            model: Model name to pull

        Returns:
            True if successful
        """
        try:
            client = await self._get_client()

            # Use streaming to handle long downloads
            async with client.stream(
                "POST",
                "/api/pull",
                json={"name": model},
                timeout=600.0,  # 10 minute timeout for large models
            ) as response:
                if response.status_code == 200:
                    async for line in response.aiter_lines():
                        if line:
                            try:
                                data = json.loads(line)
                                status = data.get("status", "")
                                if "error" in data:
                                    logger.error(f"Pull error: {data['error']}")
                                    return False
                                logger.debug(f"Pull status: {status}")
                            except json.JSONDecodeError:
                                pass
                    return True
                else:
                    logger.error(f"Pull failed: {response.status_code}")
                    return False

        except Exception as e:
            logger.error(f"Pull error: {e}")
            return False
