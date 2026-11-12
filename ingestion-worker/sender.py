import logging
from typing import List, Dict, Any
import requests
from config import BACKEND_URL, INTERNAL_API_KEY

logger = logging.getLogger(__name__)

class BackendSender:
    def __init__(self):
        self.endpoint = f"{BACKEND_URL}/api/internal/tenders/batch"
        self.headers = {
            "Content-Type": "application/json",
            "X-API-KEY": INTERNAL_API_KEY
        }

    def send_batch(self, tenders: List[Dict[str, Any]]) -> Dict[str, Any]:
        if not tenders:
            logger.info("Brak nowych przetargow do przeslania.")
            return {"processed": 0, "saved": 0, "duplicatesSkipped": 0}

        try:
            response = requests.post(
                self.endpoint,
                json=tenders,
                headers=self.headers,
                timeout=20
            )
            response.raise_for_status()
            result = response.json()
            logger.info(
                f"Sukces ingestu: Odebrano={result.get('processed')}, "
                f"Zapisano={result.get('saved')}, "
                f"Pominiete duplikaty={result.get('duplicatesSkipped')}"
            )
            return result
        except requests.exceptions.RequestException as e:
            logger.error(f"Blad przesylania danych do backendu Javy ({self.endpoint}): {e}")
            if hasattr(e, 'response') and e.response is not None:
                logger.error(f"Odpowiedz serwera: {e.response.text}")
            return {"error": str(e)}