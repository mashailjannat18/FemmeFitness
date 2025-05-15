from flask import Blueprint, request, jsonify, current_app
import requests

email_bp = Blueprint('email', __name__)

@email_bp.route('/send-confirmation-email', methods=['POST'])
def send_confirmation_email():
    try:
        data = request.get_json()
        email = data.get('email')
        code = data.get('code')

        if not email or not code:
            return jsonify({'error': 'Email and code are required'}), 400

        brevo_data = {
            'sender': {
                'name': current_app.config['BREVO_SENDER_NAME'],
                'email': current_app.config['BREVO_SENDER_EMAIL']
            },
            'to': [{'email': email}],
            'subject': 'Your Confirmation Code',
            'textContent': f'Your confirmation code is {code}. It expires in 10 minutes.',
            'htmlContent': f"""
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2>Your Confirmation Code</h2>
                <p>Your confirmation code is <strong>{code}</strong>.</p>
                <p>Please enter this code in the app to complete your registration and avail personalized fitness plans.</p>
                <p>Confirmation code: {code}</p>
                <p>If you didn't request this code, please ignore this email.</p>
            </div>
            """
        }

        response = requests.post(
            'https://api.brevo.com/v3/smtp/email',
            headers={
                'accept': 'application/json',
                'api-key': current_app.config['BREVO_API_KEY'],
                'content-type': 'application/json'
            },
            json=brevo_data
        )

        if response.status_code != 201:
            print(f"Brevo error: {response.text}")
            return jsonify({'error': f'Failed to send confirmation email: {response.text}'}), 500

        print(f"Confirmation code {code} sent to {email}, status: {response.status_code}")
        return jsonify({'message': f'Confirmation code {code} sent to {email}'}), 200

    except Exception as e:
        print(f"Error sending email: {str(e)}")
        return jsonify({'error': f'Failed to send confirmation email: {str(e)}'}), 500