from abc import ABC, abstractmethod
from typing import Any, Iterable


class SourceAdapter(ABC):
    key: str
    label: str = ""
    source_type: str = "json"

    @abstractmethod
    def fetch_raw(self) -> Any:
        raise NotImplementedError

    @abstractmethod
    def normalize(self, payload: Any) -> Iterable[Any]:
        raise NotImplementedError

    def normalize_catalog(self, payload: Any) -> Iterable[Any]:
        return ()

    def normalize_sections(self, payload: Any) -> Iterable[Any]:
        return ()

    def normalize_section_meetings(self, payload: Any) -> Iterable[Any]:
        return ()

    def normalize_outcomes(self, payload: Any) -> Iterable[Any]:
        return ()

    def normalize_community_evidence(self, payload: Any) -> Iterable[Any]:
        return ()
