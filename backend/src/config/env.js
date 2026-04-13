import 'dotenv/config';
const config = {
    JWT_SECRET: process.env.JWT_SECRET,
    MONGO_URI: process.env.MONGO_URI,
    PORT: process.env.PORT || 5000,
    EMAIL_SERVICE: process.env.EMAIL_SERVICE,
    EMAIL_SERVICE_USER: process.env.EMAIL_SERVICE_USER,
    EMAIL_SERVICE_PASS: process.env.EMAIL_SERVICE_PASS,
};

export default config;