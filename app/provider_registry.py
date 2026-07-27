"""
provider_registry.py — Adaptateurs par provider IA
Charge providers.json, expose des stratégies d'injection DOM par provider.
"""

import json
import os
from dataclasses import dataclass, field
from typing import Optional

PROVIDERS_PATH = os.path.join(os.path.dirname(__file__), "..", "config", "providers.json")


@dataclass
class Provider:
    id: str
    label: str
    url: str
    icon: str
    default_profile: str
    prompt_strategy: str  # "textarea", "contenteditable", "input"
    input_selectors: list[str] = field(default_factory=list)
    submit_selectors: list[str] = field(default_factory=list)
    response_selectors: list[str] = field(default_factory=list)


class ProviderRegistry:
    _instance = None
    _providers: dict[str, Provider] = {}

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._load()
        return cls._instance

    def _load(self):
        path = os.path.abspath(PROVIDERS_PATH)
        if not os.path.exists(path):
            self._providers = {}
            return
        with open(path, "r") as f:
            data = json.load(f)
        for item in data:
            p = Provider(**item)
            self._providers[p.id] = p

    def get(self, provider_id: str) -> Optional[Provider]:
        return self._providers.get(provider_id)

    def all(self) -> list[Provider]:
        return list(self._providers.values())

    def ids(self) -> list[str]:
        return list(self._providers.keys())

    def get_default_preset(self) -> list[Provider]:
        """Returns default 9-AI preset."""
        ids = ["gpt5_terra", "gpt5_sol", "gemini", "raisonnement", "claude", "zglm", "kimi", "grok", "nemotron"]
        return [self._providers[i] for i in ids if i in self._providers]
