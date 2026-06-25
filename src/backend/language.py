"""
Language detection module
Detects user language from first name, messages, or returns default
"""

from langdetect import detect, DetectorFactory
from textblob import TextBlob
from config import get_settings
import logging

logger = logging.getLogger(__name__)
settings = get_settings()

# Ensure consistent results
DetectorFactory.seed = 0


class LanguageDetector:
    """Handles language detection for users"""

    TELEGRAM_LANGUAGE_MAP = {
        "es": "es",
        "en": "en",
        "pt": "pt",
    }

    @staticmethod
    def detect_from_text(text: str, fallback: str = "es") -> str:
        try:
            if not text or len(text) < 3:
                return fallback
            detected = detect(text)
            if detected in settings.SUPPORTED_LANGUAGES:
                return detected
            return fallback
        except Exception as e:
            logger.warning(f"Language detection failed: {e}")
            return fallback

    @staticmethod
    def detect_from_telegram_user(user_language_code: str, fallback: str = "es") -> str:
        if not user_language_code:
            return fallback
        base_lang = user_language_code.split("_")[0].lower()
        if base_lang in LanguageDetector.TELEGRAM_LANGUAGE_MAP:
            return LanguageDetector.TELEGRAM_LANGUAGE_MAP[base_lang]
        # Language not in map (e.g., ja, ko, ru) → default to "en"
        return "en"

    @staticmethod
    def detect_combined(
        telegram_language_code: str,
        message_text: str = None,
        fallback: str = "es"
    ) -> str:
        detected = LanguageDetector.detect_from_telegram_user(telegram_language_code, None)
        if detected:
            return detected
        if message_text:
            detected = LanguageDetector.detect_from_text(message_text, None)
            if detected:
                return detected
        return fallback

    @staticmethod
    def get_language_name(language_code: str) -> str:
        names = {
            "es": "Español",
            "en": "English",
            "fr": "Français",
            "de": "Deutsch",
            "it": "Italiano",
            "pt": "Português",
            "ru": "Русский",
            "ja": "日本語",
            "zh": "中文",
            "ko": "한국어",
        }
        return names.get(language_code, language_code)


# Message templates by language
MESSAGE_TEMPLATES = {
    "es": {
        "start": "¡Bienvenido! 👋 Estoy aquí para traerte ofertas especiales cada {hours} horas.",
        "payment_required": "Para acceder a nuestro canal VIP premium, haz clic en el enlace de pago:",
        "payment_received": "¡Gracias por tu compra! 🎉 Aquí está tu enlace de invitación al canal VIP:",
        "error": "Lo siento, ocurrió un error. Por favor, intenta de nuevo.",
    },
    "en": {
        "start": "Welcome! 👋 I'm here to bring you special offers every {hours} hours.",
        "payment_required": "To access our premium VIP channel, click on the payment link:",
        "payment_received": "Thank you for your purchase! 🎉 Here's your VIP channel invite link:",
        "error": "Sorry, an error occurred. Please try again.",
    },
    "fr": {
        "start": "Bienvenue! 👋 Je suis ici pour vous apporter des offres spéciales toutes les {hours} heures.",
        "payment_required": "Pour accéder à notre canal VIP premium, cliquez sur le lien de paiement:",
        "payment_received": "Merci pour votre achat! 🎉 Voici votre lien d'invitation au canal VIP:",
        "error": "Désolé, une erreur s'est produite. Veuillez réessayer.",
    },
    "de": {
        "start": "Willkommen! 👋 Ich bin hier, um dir alle {hours} Stunden spezielle Angebote zu bringen.",
        "payment_required": "Um auf unseren Premium-VIP-Kanal zuzugreifen, klicken Sie auf den Zahlungslink:",
        "payment_received": "Danke für deinen Kauf! 🎉 Hier ist dein Einladungslink zum VIP-Kanal:",
        "error": "Entschuldigung, ein Fehler ist aufgetreten. Bitte versuche es erneut.",
    },
    "it": {
        "start": "Benvenuto! 👋 Sono qui per portarti offerte speciali ogni {hours} ore.",
        "payment_required": "Per accedere al nostro canale VIP premium, fai clic sul link di pagamento:",
        "payment_received": "Grazie per l'acquisto! 🎉 Ecco il tuo link di invito al canale VIP:",
        "error": "Scusa, si è verificato un errore. Per favore riprova.",
    },
}


def get_message_template(key: str, language: str, **kwargs) -> str:
    lang_templates = MESSAGE_TEMPLATES.get(language, MESSAGE_TEMPLATES.get("es", {}))
    template = lang_templates.get(key, "")
    if kwargs:
        try:
            return template.format(**kwargs)
        except KeyError:
            return template
    return template
