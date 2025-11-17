#!/usr/bin/env python3
"""
Entry point for running the Flask application
Run this as: python -m backend.run
"""
import os

from ..core.app import create_app


def main():
    """Main function for running the application"""
    # Отключаем логи Werkzeug и все HTTP логи
    import logging

    # Отключаем все логи Werkzeug
    logging.getLogger("werkzeug").disabled = True
    logging.getLogger("werkzeug").setLevel(logging.ERROR)
    logging.getLogger("werkzeug").propagate = False

    # Отключаем логи Flask
    logging.getLogger("flask").setLevel(logging.ERROR)

    app = create_app()
    # Respect environment variables for debug and port; disable reloader to prevent double-binding
    debug_mode = os.getenv("FLASK_DEBUG", "1") == "1"
    port = int(os.getenv("PORT", "5001"))
    app.run(debug=debug_mode, host="0.0.0.0", port=port, use_reloader=False)


if __name__ == "__main__":
    main()
