import os
from flask import Flask
from dotenv import load_dotenv

load_dotenv()

def create_app():
    app = Flask(__name__)

    app.config['BREVO_API_KEY'] = os.getenv('BREVO_API_KEY')
    app.config['BREVO_SENDER_EMAIL'] = os.getenv('BREVO_SENDER_EMAIL')
    app.config['BREVO_SENDER_NAME'] = os.getenv('BREVO_SENDER_NAME', 'Your App')

    from app.routes.workout_routes import workout_bp
    app.register_blueprint(workout_bp, url_prefix='/api')

    from app.routes import email_routes
    app.register_blueprint(email_routes.email_bp, url_prefix='/api')

    from app.routes.cycle_routes import cycle_bp
    app.register_blueprint(cycle_bp, url_prefix='/api')

    return app