async function autocompleteLocation(req, res) {

    try {

        const query =
            String(
                req.query.q || ""
            ).trim();


        if (query.length < 3) {

            return res.json({
                status: "success",
                suggestions: [],
            });
        }


        const apiKey =
            process.env.GEOAPIFY_API_KEY;


        if (!apiKey) {

            return res.status(500).json({
                status: "error",
                message:
                    "Location service is not configured.",
            });
        }


        const params =
            new URLSearchParams({
                text: query,
                format: "json",
                limit: "6",

                // Restrict suggestions to India
                filter: "countrycode:in",

                apiKey,
            });


        const response =
            await fetch(
                `https://api.geoapify.com/v1/geocode/autocomplete?${params}`
            );


        if (!response.ok) {

            throw new Error(
                "Location provider request failed."
            );
        }


        const data =
            await response.json();


        const suggestions =
            (data.results || [])
                .map(result => ({

                    formatted:
                        result.formatted ||
                        result.address_line2 ||
                        result.name,

                    address:
                        result.address_line1 ||
                        result.formatted,

                    city:
                        result.city ||
                        result.county ||
                        result.state_district ||
                        "",

                    state:
                        result.state || "",

                    postal_code:
                        result.postcode || "",

                    latitude:
                        Number(result.lat),

                    longitude:
                        Number(result.lon),

                }))
                .filter(
                    location =>
                        Number.isFinite(
                            location.latitude
                        ) &&
                        Number.isFinite(
                            location.longitude
                        )
                );


        return res.json({
            status: "success",
            suggestions,
        });


    } catch (error) {

        console.error(
            "Location autocomplete error:",
            error
        );


        return res.status(500).json({
            status: "error",
            message:
                "Unable to load address suggestions.",
        });
    }
}


module.exports = {
    autocompleteLocation,
};