from pydantic import BaseModel, Field

from app.services.ai_providers import AIProvider


class SaveAIKeyRequest(BaseModel):
    api_key: str = Field(min_length=10, max_length=500)


class AIKeyStatusResponse(BaseModel):
    provider: AIProvider
    connected: bool
