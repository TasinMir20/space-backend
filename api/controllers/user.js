const bcrypt = require("bcrypt");
const { phone: phoneNumberValidator } = require("phone");
const { isValidObjectId } = require("mongoose");
const User = require("../../models/User");
const Workspace = require("../../models/Workspace");
const WorkspaceSetting = require("../../models/WorkspaceSetting");
const Notification = require("../../models/Notification");
const Space = require("../../models/Space");
const SpaceFile = require("../../models/SpaceFile");
const Call = require("../../models/Call");
const List = require("../../models/List");
const Card = require("../../models/Card");
const SpaceChat = require("../../models/SpaceChat");
const Checklist = require("../../models/Checklist");
const CommentChat = require("../../models/CommentChat");
const UserSession = require("../../models/UserSession");
const Subscription = require("../../models/Subscription");
const { isValidEmail } = require("../../utils/func");
const { imageCheck, upload } = require("../../utils/file");
const { parseJWT } = require("../../utils/jwt");

/**
 * Get user list or search users with fullName and email
 *
 * @param {express.Request} req Express request object
 * @param {express.Response} res Express response object
 * @param {() => } next Express callback
 */
exports.getUsers = async (req, res, next) => {
	let { search, limit, skip } = req.query;
	try {
		limit = parseInt(limit) || 20;
		skip = parseInt(skip) || 0;
		const user = req.user;

		let query = {};
		if (search) {
			function es(str) {
				return str.replace(/[-\/\\^$*+?()|[\]{}]/g, "");
			}
			const KeyWordRegExp = new RegExp(".*" + es(search) + ".*", "i"); // Match any word

			query = { $and: [{ $or: [{ fullName: KeyWordRegExp }, { email: KeyWordRegExp }, { phone: KeyWordRegExp }] }, { _id: { $ne: user._id } }] };
		} else {
			query = { _id: { $ne: user._id } };
		}

		const getUsers = await User.find(query).select("fullName username avatar").sort({ createdAt: -1 }).skip(skip).limit(limit);
		return res.json({ users: getUsers });
	} catch (err) {
		next(err);
	}
};

/**
 * Get profile data of an user
 *
 * @param {express.Request} req Express request object
 * @param {express.Response} res Express response object
 * @param {() => } next Express callback
 */
exports.usersProfile = async (req, res, next) => {
	try {
		const { userId } = req.params;
		const issue = {};
		if (userId && String(userId) != String(req.user._id)) {
			if (isValidObjectId(userId)) {
				const getUser = await User.findOne({ _id: userId }).select("fullName username avatar");
				if (getUser) {
					res.json({ user: getUser });
				} else {
					issue.message = "Not found user!";
				}
			} else {
				issue.message = "Invalid user id!";
			}
		} else {
			req.user.emailVerified = undefined;
			req.user.phoneVerified = undefined;

			const u = JSON.parse(JSON.stringify(req.user));
			u.subscription = await Subscription.findOne({ user: req.user._id, expiredDate: { $gt: new Date() } })
				.sort({ createdAt: 1 })
				.select("type paid stop startDate expiredDate -_id");
			return res.json({ user: u });
		}

		return res.status(400).json({ issue });
	} catch (err) {
		next(err);
	}
};

/**
 * Update user data with user own self
 *
 * @param {express.Request} req Express request object
 * @param {express.Response} res Express response object
 * @param {() => } next Express callback
 */
exports.updateProfile = async (req, res, next) => {
	let { fullName, username, email, phone, currentPassword, newPassword } = req.body;
	try {
		const user = req.user;

		const issue = {};

		let fullNameOk, usernameOk, emailOk, phoneOk, avatarOk, currentPasswordOk, newPasswordOk;
		// Full name check
		if (fullName) {
			const letters = /^[A-Za-z\s]+$/; // Name char validation
			fullName = String(fullName).replace(/  +/g, " ").trim();
			const validFirstName = fullName.match(letters);
			if (validFirstName) {
				fullNameOk = true;
			} else {
				issue.fullName = "Full name is not valid!";
			}
		} else {
			fullName = undefined;
			fullNameOk = true;
		}

		// Username check
		if (username) {
			username = String(username).toLowerCase().trim();
			if (username.length <= 46 && username.length >= 3) {
				const usernameRegex = /^[a-zA-Z0-9]+$/;
				if (username.match(usernameRegex)) {
					const startWithNumber = /^\d/.test(username);
					if (!startWithNumber) {
						const usernameExist = await User.findOne({ $and: [{ username }, { _id: { $ne: user._id } }] });
						if (!usernameExist) {
							usernameOk = true;
						} else {
							issue.username = "This username is not available.";
						}
					} else {
						issue.username = "Username can not start with numbers!";
					}
				} else {
					issue.username = "Please only enter uppercase or lower case letters!";
				}
			} else {
				issue.username = "Username could be 3 to 46 characters long!";
			}
		} else {
			username = undefined;
			usernameOk = true;
		}

		// check email
		if (email) {
			email = String(email).replace(/  +/g, "").trim();
			const emailLengthOk = email.length < 40;
			if (emailLengthOk) {
				if (isValidEmail(email)) {
					const emailExist = await User.exists({ $and: [{ email }, { _id: { $ne: user._id } }] });
					if (!emailExist) {
						emailOk = true;
					} else {
						issue.email = "An account has already associated with the email!";
					}
				} else {
					issue.email = "Please enter valid email address!";
				}
			} else {
				issue.email = "Email length is too long!";
			}
		} else {
			email = undefined;
			emailOk = true;
		}

		// check phone
		if (phone) {
			const validateNumber = phoneNumberValidator(phone);
			if (validateNumber.isValid) {
				phone = validateNumber.phoneNumber;
				const phoneExist = await User.exists({ $and: [{ phone }, { _id: { $ne: user._id } }] });
				if (!phoneExist) {
					phoneOk = true;
				} else {
					issue.phone = "An account has already associated with the phone!";
				}
			} else {
				issue.phone = "Invalid phone number!";
			}
		} else {
			phone = undefined;
			phoneOk = true;
		}

		// check password
		if (currentPassword || newPassword) {
			if (currentPassword && newPassword) {
				const userPass = await User.findOne({ _id: user._id }).select("password");
				if (newPassword.length >= 8 && newPassword.length <= 32) {
					const strongPasswordRegex = /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z]).{8,32}$/;
					const passwordStrong = newPassword.match(strongPasswordRegex);
					if (passwordStrong) {
						const newPassCurrentPassMatched = bcrypt.compareSync(newPassword, userPass.password);
						if (!newPassCurrentPassMatched) {
							const salt = bcrypt.genSaltSync(11);
							newPassword = bcrypt.hashSync(newPassword, salt);
							newPasswordOk = true;

							const jwt_payload = parseJWT(req.headers.authorization.split(" ")[1]);
							// Logout from others device
							await UserSession.deleteMany({ $and: [{ _id: { $ne: jwt_payload.sessionId } }, { user: user._id }, { sessionName: "UserLoginSession" }] });
						} else {
							issue.newPassword = "Current password can not be a new password!";
						}
					} else {
						issue.newPassword = "Please enter strong password!";
					}
				} else {
					issue.newPassword = "Password length should be 8 to 32 characters long!";
				}

				const passwordMatched = bcrypt.compareSync(currentPassword, userPass.password);
				if (passwordMatched) {
					currentPasswordOk = true;
				} else {
					issue.currentPassword = "Password was wrong!";
				}
			} else {
				if (!newPassword) {
					issue.newPassword = "Please enter new password!";
				} else if (!currentPassword) {
					issue.currentPassword = "Please enter current password!";
				}
			}
		} else {
			currentPassword = undefined;
			newPassword = undefined;
			newPasswordOk = true;
			currentPasswordOk = true;
		}

		if (fullNameOk && usernameOk && emailOk && phoneOk && currentPasswordOk && newPasswordOk) {
			if (req.files && req.files.avatar) {
				const theAvatar = req.files.avatar;
				const checkImage = imageCheck(theAvatar);
				if (checkImage.status) {
					var uploadResult = await upload(theAvatar.path);
					if (uploadResult.secure_url) {
						avatarOk = true;
						var avatarUrl = uploadResult.secure_url;
					} else {
						issue.avatar = uploadResult.message;
					}
				} else {
					issue.avatar = checkImage.message;
				}
			} else {
				avatarOk = true;
			}

			if (avatarOk) {
				const userUpdate = await User.updateOne(
					{ _id: user._id },
					{
						fullName,
						username,
						email,
						avatar: avatarUrl,
						phone,
						password: newPassword,
					}
				);

				if (userUpdate.modifiedCount) {
					return res.json({ message: "Successfully updated!" });
				} else {
					issue.message = "Failed to update";
				}
			}
		}
		return res.status(400).json({ issue });
	} catch (err) {
		next(err);
	}
};

/**
 * Delete user own self
 *
 * @param {express.Request} req Express request object
 * @param {express.Response} res Express response object
 * @param {() => } next Express callback
 */
exports.deleteAccount = async (req, res, next) => {
	try {
		const user = req.user;

		// find the spaces where manager im
		const findSpaces = await Space.find({ members: { $elemMatch: { member: user._id, role: "manager" } } }).select("_id");

		for (const space of findSpaces) {
			await List.deleteMany({ spaceRef: space._id });
			await SpaceChat.deleteMany({ to: space._id });
			await SpaceFile.deleteMany({ spaceRef: space._id });
			await Call.deleteMany({ space: space._id });
			await Card.deleteMany({ spaceRef: space._id });
			await Checklist.deleteMany({ spaceRef: space._id });
			await CommentChat.deleteMany({ spaceRef: space._id });
		}
		await Space.deleteMany({ members: { $elemMatch: { member: user._id, role: "manager" } } });
		await Space.updateMany(
			{ members: { $elemMatch: { member: user._id, role: "member" } } },
			{
				$pull: {
					members: {
						member: user._id,
					},
				},
			}
		);

		await Workspace.updateOne(
			{ teamMembers: { $elemMatch: { member: user._id } } },
			{
				$pull: {
					teamMembers: {
						member: user._id,
					},
				},
			}
		);
		await WorkspaceSetting.deleteMany({ user: user._id });
		await Notification.deleteMany({ user: user._id });
		await Subscription.deleteMany({ user: user._id });
		await UserSession.deleteMany({ user: user._id });
		await User.deleteOne({ _id: user._id });

		res.json({ message: "Your account has been deleted!" });
	} catch (err) {
		next(err);
	}
};
