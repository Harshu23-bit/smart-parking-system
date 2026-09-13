require("dotenv").config();

const app = require("./app");
const pool = require("./config/db");

const PORT = process.env.PORT || 3000;

async function startServer() {
    try {
        await pool.query("SELECT 1");

        console.log("PostgreSQL connection established.");

        app.listen(PORT, () => {
            console.log(`ParkSmart API running on http://localhost:${PORT}`);
        });
    } catch (error) {
        console.error("Unable to start server.");
        console.error(error);
        process.exit(1);
    }
}

startServer();