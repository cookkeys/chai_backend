import { Router } from "express";
import {    changeCurrentPassword,
            getCurrentUser,
            getUserChannelProfile,
            getWatchHistory,
            registerUser,
            updateAccountDetails,
            updateUserAvatar,
            updateUserCoverImage
         } from "../controllers/user.controller.js";
import { upload } from "../middlewares/multer.middleware.js";
import { loginUser } from "../controllers/user.controller.js";
import { logoutUser } from "../controllers/user.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { refreshAccessToken } from "../controllers/user.controller.js";

const router = Router();

router.route("/register").post(
    upload.fields([
        {
            name:"avatar",
            maxCount: 1
        },
        {
            name: "coverImage",
            maxCount:1
        }
    ]),
    registerUser
);  //upload middleware(for uploading files) injected

router.route("/login").post(loginUser)  

//secured routes
router.route("/logout").post(verifyJWT,  logoutUser)
router.route("/refresh-token").post(refreshAccessToken) //add route for refreshing the token

router.route("/change-password").post(verifyJWT, changeCurrentPassword)
router.route("/current-user").post(verifyJWT, getCurrentUser)
router.route("/update-account").patch(verifyJWT, updateAccountDetails)
router.route("/current-user").post(verifyJWT, getCurrentUser)   // used for as we don't want to update all details
router.route("/avatar").patch(verifyJWT, upload.single("avatar"), updateUserAvatar)    // .patch as we are expecting avatar file
router.route("/cover-image").patch(verifyJWT, upload.single("/coverImage"), updateUserCoverImage)
router.route("/c/:username").get(verifyJWT, getUserChannelProfile) // /c/ when taking data from params 
router.route("/history").get(verifyJWT, getWatchHistory)



export default router;