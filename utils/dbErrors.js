/**
 * Maps pg / network errors to a message safe to show the user.
 */
function dbFailureMessage(err, fallback) {
    const code = err.code;
    const firstSub = err.errors?.[0];
    const subCode = firstSub?.code;

    if (
        code === "ECONNREFUSED" ||
        code === "ETIMEDOUT" ||
        code === "ENOTFOUND" ||
        subCode === "ECONNREFUSED" ||
        subCode === "ETIMEDOUT" ||
        subCode === "ENOTFOUND"
    ) {
        return (
            "Cannot connect to the database. If DATABASE_URL points at PostgreSQL, start it (for example: docker compose up -d in the project folder). " +
            "For a quick local run with no install, set DATABASE_URL=memory in your .env (data is cleared when the server stops)."
        );
    }

    if (err.message && /password authentication failed/i.test(err.message)) {
        return "Database login failed: wrong username or password in DATABASE_URL.";
    }

    if (code === "23505") {
        return "An account with this email already exists.";
    }

    if (process.env.NODE_ENV !== "production" && err.message) {
        return `${fallback} (${err.message})`;
    }

    return fallback;
}

function dbFailureStatus(err) {
    const code = err.code;
    const subCode = err.errors?.[0]?.code;
    if (
        code === "ECONNREFUSED" ||
        code === "ETIMEDOUT" ||
        code === "ENOTFOUND" ||
        subCode === "ECONNREFUSED" ||
        subCode === "ETIMEDOUT" ||
        subCode === "ENOTFOUND"
    ) {
        return 503;
    }
    return 500;
}

module.exports = { dbFailureMessage, dbFailureStatus };
