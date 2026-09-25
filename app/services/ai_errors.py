class AIKeyInvalid(Exception):
    """The provider rejected the API key."""


class AIRequestError(Exception):
    """The provider call failed or returned no usable text."""
