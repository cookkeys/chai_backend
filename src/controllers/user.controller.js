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



export {registerUser, loginUser, logoutUser, refreshAccessToken};