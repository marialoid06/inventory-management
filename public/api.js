const BASE_URL = "https://inventory-backend-2gzl.onrender.com";

const apiCall = async (endpoint, body, token = null) => {
    try {
        const response = await fetch(`${BASE_URL}/api/${endpoint}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(token && { Authorization: `Bearer ${token}` })
            },
            body: JSON.stringify(body)
        });

        const data = await response.json();
        return { ok: response.ok, data };
    } catch (error) {
        return { ok: false, data: { message: 'Network error' } };
    }
};
