from pydantic import BaseModel


class SaveAnthropicKeyRequest(BaseModel):
    api_key: str


class AnthropicKeyStatusResponse(BaseModel):
    connected: bool
