const apiCall = async (endpoint, body, token = null) => {
    try {
        const response = await fetch(`/api/${endpoint}`, {
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
