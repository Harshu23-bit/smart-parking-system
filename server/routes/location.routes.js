const express =
    require("express");


const {
    autocompleteLocation,
} =
    require(
        "../controllers/location.controller"
    );


const router =
    express.Router();


router.get(
    "/autocomplete",
    autocompleteLocation
);


module.exports =
    router;