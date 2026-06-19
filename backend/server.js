const app = require('./src/app');
const pool = require('./src/config/database');

const PORT = process.env.PORT || 5001;

pool.connect()
    .then(() => {
        console.log('✅ Database connected');
        app.listen(PORT, () => {
            console.log(`🚀 Server running on http://localhost:${PORT}`);
        });
    })
    .catch(err => {
        console.error('❌ Database connection error:', err.message);
        process.exit(1);
    });
    