const { UTApi } = require("uploadthing/server");
const config = require("../config");

const utapi = new UTApi({
    apiKey: config.uploadthingToken,
});

/**
 * Uploads a buffer to UploadThing.
 * @param {Buffer} buffer - Image buffer
 * @param {string} fileName - Name of the file
 * @returns {Promise<string>} - The URL of the uploaded file
 */
async function uploadToUploadThing(buffer, fileName) {
    try {
        // Create a File-like object from the buffer
        const file = new File([buffer], fileName, { type: "image/jpeg" });

        const response = await utapi.uploadFiles([file]);

        if (response && response[0] && response[0].data) {
            console.log(`[UploadThing] File uploaded successfully: ${response[0].data.url}`);
            return response[0].data.url;
        } else {
            throw new Error(response[0].error?.message || "Upload failed");
        }
    } catch (error) {
        console.error("[UploadThing] Error uploading file:", error.message);
        throw error;
    }
}

module.exports = {
    uploadToUploadThing,
};
