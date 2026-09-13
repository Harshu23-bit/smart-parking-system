const multer =
    require("multer");

const path =
    require("path");

const fs =
    require("fs");

const crypto =
    require("crypto");


const uploadDirectory =
    path.join(
        __dirname,
        "../uploads/parking"
    );


fs.mkdirSync(
    uploadDirectory,
    {
        recursive: true,
    }
);


const ALLOWED_MIME_TYPES =
    new Set([
        "image/jpeg",
        "image/png",
        "image/webp",
    ]);


const storage =
    multer.diskStorage({

        destination: (
            req,
            file,
            callback
        ) => {

            callback(
                null,
                uploadDirectory
            );
        },


        filename: (
            req,
            file,
            callback
        ) => {

            const extension =
                path.extname(
                    file.originalname
                )
                .toLowerCase();


            const safeName =
                `${Date.now()}-${crypto.randomUUID()}${extension}`;


            callback(
                null,
                safeName
            );
        },
    });


const uploader =
    multer({

        storage,

        limits: {
            fileSize:
                5 * 1024 * 1024,

            files:
                5,
        },

        fileFilter: (
            req,
            file,
            callback
        ) => {

            if (
                !ALLOWED_MIME_TYPES.has(
                    file.mimetype
                )
            ) {

                const error =
                    new Error(
                        "Only JPG, PNG, and WebP images are allowed."
                    );

                error.code =
                    "INVALID_IMAGE_TYPE";

                return callback(
                    error
                );
            }


            callback(
                null,
                true
            );
        },
    });


function parkingImageUpload(
    req,
    res,
    next
) {

    uploader.array(
        "images",
        5
    )(
        req,
        res,
        error => {

            if (!error) {
                return next();
            }


            if (
                error instanceof
                multer.MulterError
            ) {

                if (
                    error.code ===
                    "LIMIT_FILE_SIZE"
                ) {

                    return res.status(400).json({
                        status:
                            "error",

                        message:
                            "Each parking image must be 5 MB or smaller.",
                    });
                }


                if (
                    error.code ===
                    "LIMIT_FILE_COUNT"
                ) {

                    return res.status(400).json({
                        status:
                            "error",

                        message:
                            "You can upload a maximum of 5 images at once.",
                    });
                }


                return res.status(400).json({
                    status:
                        "error",

                    message:
                        "Unable to upload parking images.",
                });
            }


            return res.status(400).json({
                status:
                    "error",

                message:
                    error.message ||
                    "Invalid parking image.",
            });
        }
    );
}


module.exports = {
    parkingImageUpload,
    uploadDirectory,
};