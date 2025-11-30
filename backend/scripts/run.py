
"""
Entry point for running the Flask application
Run this as: python -m backend.run
"""
import os
from ..core.app import create_app
def main():
    """Main function for running the application"""
    import logging
    logging.getLogger("werkzeug").disabled = True
    logging.getLogger("werkzeug").setLevel(logging.ERROR)
    logging.getLogger("werkzeug").propagate = False
    logging.getLogger("flask").setLevel(logging.ERROR)
    app = create_app()
    debug_mode = os.getenv("FLASK_DEBUG", "1") == "1"
    port = int(os.getenv("PORT", "5001"))
    app.run(debug=debug_mode, host="0.0.0.0", port=port, use_reloader=debug_mode)
if __name__ == "__main__":
    main()