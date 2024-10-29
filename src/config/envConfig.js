import dotenv from 'dotenv';

dotenv.config();

export default {
    PORT: process.env.PORT,
    APP_PASSWORD: process.env.APP_PASSWORD,
    API_URL: process.env.API_URL,
    API_KEY: process.env.API_KEY,
    PROGRAM_ID: process.env.PROGRAM_ID
}