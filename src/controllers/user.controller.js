import { asyncHandler } from "../utils/asyncHandler.js";
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import { User } from "../models/user.model.js";
import {uploadOnCloudinary} from "../utils/cloudinary.js"
import jwt from "jsonwebtoken";

const generateAccessAndRefereshTokens = async(userId) =>{
    try {
        const user = await User.findById(userId)    // get user id  
        const accessToken = user.generateAccessToken()  // generate access token (method from user model)
        const refreshToken = user.generateRefreshToken()    // generate refresh token (method from user model)

        user.refreshToken = refreshToken    // putting/saving refresh token in db
        await user.save({ validateBeforeSave: false })  
        // saving refresh token only(not other fields from model) in db 

        return {accessToken, refreshToken}  //return access and refresh tokens


    } catch (error) {
        throw new ApiError(500, "Something went wrong while generating referesh and access token")
    }
}   // made seperate method to taking and generating access token and refresh token.

const registerUser = asyncHandler( async (req, res) => {
// to-do's for registerUser
    // get user details from frontend
    // validation - not empty
    // check if user already exists: username, email
    // check for images, check for avatar
    // upload them to cloudinary, avatar
    // create user object - create entry in db
    // remove password and refresh token field from response
    // check for user creation  (in db)
    // return res


    const {fullName, email, username, password } = req.body // get user details from frontend
    //console.log("email: ", email);

    if (
        [fullName, email, username, password].some((field) => field?.trim() === "")
    ) {
        throw new ApiError(400, "All fields are required")
    }   // validation - not empty
    

    const existedUser = await User.findOne({
        $or: [{ username }, { email }]
    })  // check if user already exists: username, email

    if (existedUser) {
        throw new ApiError(409, "User with email or username already exists")
    }
    //console.log(req.files);


    // file handling: 
    const avatarLocalPath = req.files?.avatar[0]?.path; // check for images, check for avatar
    //const coverImageLocalPath = req.files?.coverImage[0]?.path;

    let coverImageLocalPath;
    if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0) {
        coverImageLocalPath = req.files.coverImage[0].path
    }
    

    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar file is required")
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath)
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)
    // upload them to cloudinary, avatar

    if (!avatar) {
        throw new ApiError(400, "Avatar file is required")
    }
   

    const user = await User.create({
        fullName,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        email, 
        password,
        username: username.toLowerCase()
    })  // create user object - create entry in db

    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )   // remove password and refresh token field from response

    if (!createdUser) {
        throw new ApiError(500, "Something went wrong while registering the user")
    }

    return res.status(201).json(
        new ApiResponse(200, createdUser, "User registered Successfully")
    )   // return res

} )

//to-do's for loginUser:
    //get the data from frontend
    //give access on basis (of email or username)
    //find user in database
    //check password entered by user
    //generate and send access token and refresh token to the user (using generateAccessAndRefereshTokens method)
    //send token in cookies
    //send response


    const loginUser = asyncHandler(async (req, res) =>{
    
        const {email, username, password} = req.body    //get the data from frontend
        console.log(email);
    
        if (!username && !email) {
            throw new ApiError(400, "username or email is required")
        }   //give access on basis (of email or username)
        
        // Here is an alternative of above code based on logic discussed in video:
        // if (!(username || email)) {
        //     throw new ApiError(400, "username or email is required")
            
        // }
    
        const user = await User.findOne({
            $or: [{username}, {email}]
        })  //find user in database
    
        if (!user) {
            throw new ApiError(404, "User does not exist")
        }
    
       const isPasswordValid = await user.isPasswordCorrect(password)   //check password entered by user
    
       if (!isPasswordValid) {
        throw new ApiError(401, "Invalid user credentials")
        }
    
       const {accessToken, refreshToken} = await generateAccessAndRefereshTokens(user._id)
       //generate and send access token and refresh token to the user (using generateAccessAndRefereshTokens method)
    
        const loggedInUser = await User.findById(user._id).select("-password -refreshToken")
    
        const options = {
            httpOnly: true,
            secure: true
        }
    
        return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)  //send token in cookies
        .json(
            new ApiResponse(
                200, 
                {
                    user: loggedInUser, accessToken, refreshToken
                },
                "User logged In Successfully"
            )
        )   //send response
    
    })


//to-do's for logoutUser:
//verify the user (using auth middleware):
    //Get access token from cookies or from header(Authorization)
    //verify Token
    //Create a response after verifying the token
    //store it in an object(of any name)
    // run next() (as it is a middleware)
//inject middleware in routes(logoutUser)
//create a logout controller method
    //find the user
    //update refresh token and set it to undefined
    //clear cookies
    //send response

    const logoutUser = asyncHandler(async(req, res) => {
        await User.findByIdAndUpdate(
            req.user._id,   //find the user
            {
                $unset: {
                    refreshToken: 1 // this removes the field from document
                                    //update refresh token and set it to undefined
                }
            },
            {
                new: true
            }
        )
    
        const options = {
            httpOnly: true,
            secure: true
        }
    
        return res
        .status(200)
        .clearCookie("accessToken", options)
        .clearCookie("refreshToken", options)
        .json(new ApiResponse(200, {}, "User logged Out"))  //clear cookies
    })  //send response
    
//to-do's for refreshing access token method 
    //obtain refresh token from cookies or body
    //decode the obtained token
    //find the user using decoded token
    //check obtained refresh token and user's token
    //generate new access token (using "generateAccessandRefreshTokens" method)
    //send response as cookies(server modifiable only)
    //add route for refreshing token

    const refreshAccessToken = asyncHandler(async (req, res) => {
        const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken
        //obtain refresh token from cookies or body
    
        if (!incomingRefreshToken) {
            throw new ApiError(401, "unauthorized request")
        }
    
        try {
            const decodedToken = jwt.verify(
                incomingRefreshToken,
                process.env.REFRESH_TOKEN_SECRET
            )   //decode the obtained token
        
            const user = await User.findById(decodedToken?._id) //find the user using decoded token
        
            if (!user) {
                throw new ApiError(401, "Invalid refresh token")
            }
        
            if (incomingRefreshToken !== user?.refreshToken) {
                throw new ApiError(401, "Refresh token is expired or used")
            }   //check obtained refresh token and user's token
        
            const options = {
                httpOnly: true,
                secure: true
            }
        
            const {accessToken, newRefreshToken} = await generateAccessAndRefereshTokens(user._id)
            //generate new access token (using "generateAccessandRefreshTokens" method)
        
            return res
            .status(200)
            .cookie("accessToken", accessToken, options)
            .cookie("refreshToken", newRefreshToken, options)
            .json(
                new ApiResponse(
                    200, 
                    {accessToken, refreshToken: newRefreshToken},
                    "Access token refreshed"
                )
            )
        } catch (error) {
            throw new ApiError(401, error?.message || "Invalid refresh token")
        }   //send response as cookies(server modifiable only)
    })
    //add route for refreshing token (in user.route)


    const changeCurrentPassword = asyncHandler(async(req, res) => {
        const {oldPassword, newPassword} = req.body // take current and new password from the user
    
        
    
        const user = await User.findById(req.user?._id) // find user in db
        const isPasswordCorrect = await user.isPasswordCorrect(oldPassword) // compare old and new passwords
    
        if (!isPasswordCorrect) {
            throw new ApiError(400, "Invalid old password")
        }
    
        user.password = newPassword // update password
        await user.save({validateBeforeSave: false})    // 
    
        return res
        .status(200)
        .json(new ApiResponse(200, {}, "Password changed successfully"))    // return response
    })

    const getCurrentUser = asyncHandler(async(req, res) => {
        return res
        .status(200)
        .json(new ApiResponse(
            200,
            req.user,   // find user using middleware object
            "User fetched successfully"
        ))
    })


    const updateAccountDetails = asyncHandler(async(req, res) => {
        const {fullName, email} = req.body  // take data from user
    
        if (!fullName || !email) {
            throw new ApiError(400, "All fields are required")
        }
    
        const user = await User.findByIdAndUpdate(
            req.user?._id,  // find user
            {
                $set: {
                    fullName,
                    email: email
                }   // sets/updates email and fullname ($set mongoDB operator)
            },
            {new: true} // return the updated info/fields (after updating)
            
        ).select("-password")
    
        return res
        .status(200)
        .json(new ApiResponse(200, user, "Account details updated successfully"))   // return response
    });

    const updateUserAvatar = asyncHandler(async(req, res) => {
        const avatarLocalPath = req.file?.path  // take avatar image from user(using multer middleware)
    
        if (!avatarLocalPath) {
            throw new ApiError(400, "Avatar file is missing")
        }
    
        //TODO: delete old image - assignment
    
        const avatar = await uploadOnCloudinary(avatarLocalPath) // upload avatar in cloudinary
    
        if (!avatar.url) {
            throw new ApiError(400, "Error while uploading on avatar")
            
        }
    
        const user = await User.findByIdAndUpdate(
            req.user?._id,  // find user
            {
                $set:{
                    avatar: avatar.url
                }   // updates the fields in document
            },
            {new: true} // update avatar image
        ).select("-password")
    
        return res
        .status(200)
        .json(
            new ApiResponse(200, user, "Avatar image updated successfully")
        )   // return response
    })

    const updateUserCoverImage = asyncHandler(async(req, res) => {
        const coverImageLocalPath = req.file?.path  // take cover image from user(using multer middleware)
    
        if (!coverImageLocalPath) {
            throw new ApiError(400, "Cover image file is missing")
        }
    
        //TODO: delete old image - assignment
    
    
        const coverImage = await uploadOnCloudinary(coverImageLocalPath)    // upload coverImage in cloudinary
    
        if (!coverImage.url) {
            throw new ApiError(400, "Error while uploading on avatar")
            
        }
    
        const user = await User.findByIdAndUpdate(
            req.user?._id,  // find user
            {
                $set:{
                    coverImage: coverImage.url
                }   // updates the fields in document
            },
            {new: true} // update avatar image
        ).select("-password")
    
        return res
        .status(200)
        .json(
            new ApiResponse(200, user, "Cover image updated successfully")
        )   // return response
    })


    const getUserChannelProfile = asyncHandler(async(req, res) => {
        const {username} = req.params   // take username from url
    
        if (!username?.trim()) {
            throw new ApiError(400, "username is missing")
        }
    
        const channel = await User.aggregate([
            {
                $match: {
                    username: username?.toLowerCase()
                }
            },  // first pipeline
            // this filters the document, and it selects one specific doc(with target username)
            {
                $lookup: {
                    from: "subscriptions",  // name of entry in db
                    localField: "_id",
                    foreignField: "channel",
                    as: "subscribers"   // name of field
                }    // counts the number of subscribers of the username's channel
            },
            {
                $lookup: {
                    from: "subscriptions",
                    localField: "_id",
                    foreignField: "subscriber",
                    as: "subscribedTo"  // name of field
                }   // found all the channel that user have subscribed to (with couting)
            },
            {
                $addFields: {
                    subscribersCount: {
                        $size: "$subscribers"
                    },  // add an additional field of count of subscribers
                    // add an extra field in the entry in db
                    channelsSubscribedToCount: {
                        $size: "$subscribedTo"
                    },  // add an additional field of count of subscribed channels
                    // add an extra field in the entry in db
                    isSubscribed: {
                        $cond: {
                            if: {$in: [req.user?._id, "$subscribers.subscriber"]},  
                            // if the user in subscribers list.
                            then: true, // if cond is true
                            else: false // if cond is false
                        }
                    }   // boolean for channel is subcribed or not.
                }
            },
            {
                $project: {
                    fullName: 1,
                    username: 1,
                    subscribersCount: 1,
                    channelsSubscribedToCount: 1,
                    isSubscribed: 1,
                    avatar: 1,
                    coverImage: 1,
                    email: 1
    
                }
            }   // projecting/showing the added fields in the server
        ])
    
        if (!channel?.length) {
            throw new ApiError(404, "channel does not exists")
        }
    
        return res
        .status(200)
        .json(
            new ApiResponse(200, channel[0], "User channel fetched successfully")
        )
    })

    const getWatchHistory = asyncHandler(async(req, res) => {
        const user = await User.aggregate([
            {
                $match: {
                    _id: new mongoose.Types.ObjectId(req.user._id) //find user without any field (using object id)
                    // created a mongoose object id for finding the user.
                }
            },
            {
                $lookup: {
                    from: "videos", // look up in videos
                    localField: "watchHistory", // here local field is watchHistory
                    foreignField: "_id",    // there field is _id
                    as: "watchHistory", // name of field 
                    pipeline: [
                        {
                            $lookup: {      // inside video
                                from: "users",  // lookup in users
                                localField: "owner",    // here local field is owner
                                foreignField: "_id",    // there field is _id
                                as: "owner",    // name of field
                                pipeline: [ 
                                    {
                                        $project: {
                                            fullName: 1,
                                            username: 1,
                                            avatar: 1
                                        }   // data to be shown when in watchHistory
                                    }
                                ]   // add another sub-pipeline for "owner" field in video model
                                // pipeline inside videos pipeline (inner pipeline)
                            }   // outer pipeline
                        },
                        {
                            $addFields:{
                                owner:{
                                    $first: "$owner"
                                }
                            }   
                        }
                    ]
                }
            }
        ])
    
        return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                user[0].watchHistory,   // returned the first data from aggregation pipeline from watchHistroy fie
                "Watch history fetched successfully"
            )
        )
    })


export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetails,
    updateUserAvatar,
    updateUserCoverImage,
    getUserChannelProfile,
    getWatchHistory
};