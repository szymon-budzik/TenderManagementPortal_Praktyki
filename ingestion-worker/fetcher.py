import json
import logging
from typing import List, Dict, Any
import requests

logger = logging.getLogger(__name__)

class TenderFetcher:
    def fetch_from_source(self, source: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Pobiera dane z dynamicznie skonfigurowanego endpointu."""
        url = source.get("url")
        method = source.get("httpMethod", "GET").upper()
        payload_str = source.get("payload")

        headers = {
            "Accept": "application/json",
            "User-Agent": "TenderIngestionWorker/1.0"
        }

        try:
            if method == "POST":
                headers["Content-Type"] = "application/json"
                body = json.loads(payload_str) if payload_str else {}
                response = requests.post(url, json=body, headers=headers, timeout=15)
            else:
                response = requests.get(url, headers=headers, timeout=15)

            response.raise_for_status()
            data = response.json()
            
            items = data.get("items", []) if isinstance(data, dict) else data
            return self._normalize_items(items)

        except Exception as e:
            logger.error(f"Blad podczas odpytywania endpointu '{source.get('name')}' ({url}): {e}")
            return []

    def _normalize_items(self, raw_items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        normalized = []
        for item in raw_items:
            external_id = (
                item.get("objectId") 
                or item.get("noticeNumber") 
                or item.get("id")
            )
            title = item.get("orderObject") or item.get("title") or "Brak tytułu"
            description = (
                item.get("shortDescription") 
                or item.get("description") 
                or f"Przetarg zamawiającego: {item.get('purchaserName', 'Nieznany')}"
            )
            pub_date = item.get("publicationDate")

            if external_id:
                normalized.append({
                    "externalId": str(external_id),
                    "title": title.strip(),
                    "description": description.strip() if description else None,
                    "publicationDate": pub_date
                })

        return normalized