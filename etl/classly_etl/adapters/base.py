from abc import ABC, abstractmethod
from typing import Any, Iterable


class SourceAdapter(ABC):
    key: str

    @abstractmethod
    def fetch_raw(self) -> Any:
        raise NotImplementedError

    @abstractmethod
    def normalize(self, payload: Any) -> Iterable[Any]:
        raise NotImplementedError
