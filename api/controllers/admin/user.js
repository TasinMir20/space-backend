const { isValidObjectId } = require("mongoose");
const User = require("../../../models/User");
const UserSession = require("../../../models/UserSession");
const Workspace = require("../../../models/Workspace");
const WorkspaceSetting = require("../../../models/WorkspaceSetting");
const Space = require("../../../models/Space");
const SpaceFile = require("../../../models/SpaceFile");
const Call = require("../../../models/Call");
const List = require("../../../models/List");
const SpaceChat = require("../../../models/SpaceChat");
const Card = require("../../../models/Card");
const Checklist = require("../../../models/Checklist");
const CommentChat = require("../../../models/CommentChat");
const Notification = require("../../../models/Notification");
const Subscription = require("../../../models/Subscription");
const { Types } = require("mongoose");

/**
 * Get users list
 *
 * @param {express.Request} req Express request object
 * @param {express.Response} res Express response object
 * @param {() => } next Express callback
 */
exports.getUsersList = async (req, res, next) => {
	let { search, limit, skip } = req.query;
	try {
		limit = parseInt(limit) || 20;
		skip = parseInt(skip) || 0;
		const admin = req.admin;

		let query = {};
		if (search) {
			function es(str) {
				return str.replace(/[-\/\\^$*+?()|[\]{}]/g, "");
			}
			const KeyWordRegExp = new RegExp(".*" + es(search) + ".*", "i"); // Match any word

			query = { $or: [{ fullName: KeyWordRegExp }, { email: KeyWordRegExp }] };
		}

		let getUsers = await User.find(query).select("fullName username email avatar createdAt").sort({ createdAt: -1 }).skip(skip).limit(limit);
		getUsers = JSON.parse(JSON.stringify(getUsers));

		for (const user of getUsers) {
			const workspaces = await Workspace.aggregate([
				{
					$match: {
						teamMembers: {
							$elemMatch: {
								member: Types.ObjectId(user._id),
								role: "owner",
							},
						},
					},
				},
				{
					$project: {
						_id: 1,
						totalTeamMembers: { $size: "$teamMembers" },
					},
				},
			]);

			user.workspacesCount = workspaces.length;

			let totalTeamMembers = 0;
			let workspaceIds = [];
			for (const workspace of workspaces) {
				totalTeamMembers = totalTeamMembers + (workspace?.totalTeamMembers || 0);
				workspaceIds.push(workspace._id);
			}

			user.teamMembers = totalTeamMembers;
			user.spaceCount = await Space.countDocuments({ workSpaceRef: { $in: workspaceIds } });
		}

		const userCount = await User.countDocuments({});

		return res.json({ users: getUsers, userCount });
	} catch (err) {
		next(err);
	}
};

exports.getSingleUser = async (req, res, next) => {
	const { userId } = req.params;
	try {
		const issue = {};

		if (isValidObjectId(userId)) {
			let getUser = await User.findOne({ _id: userId }).select("fullName username email avatar createdAt");

			if (getUser) {
				getUser = JSON.parse(JSON.stringify(getUser));

				const workspaces = await Workspace.aggregate([
					{
						$match: {
							teamMembers: {
								$elemMatch: {
									member: Types.ObjectId(getUser._id),
									role: "owner",
								},
							},
						},
					},
					{
						$project: {
							_id: 1,
							totalTeamMembers: { $size: "$teamMembers" },
						},
					},
				]);

				getUser.workspacesCount = workspaces.length;

				let totalTeamMembers = 0;
				let workspaceIds = [];
				for (const workspace of workspaces) {
					totalTeamMembers = totalTeamMembers + (workspace?.totalTeamMembers || 0);
					workspaceIds.push(workspace._id);
				}

				getUser.teamMembers = totalTeamMembers;
				getUser.spaceCount = await Space.countDocuments({ workSpaceRef: { $in: workspaceIds } });
			}

			return res.json({ user: getUser });
		} else {
			issue.userId = "Invalid user Id!";
		}

		res.status(400).json({ issue });
	} catch (err) {
		next(err);
	}
};

exports.deleteSingleUser = async (req, res, next) => {
	const admin = req.admin;
	const issue = {};
	const { userId } = req.params;
	try {
		if (isValidObjectId(userId)) {
			const userExist = await User.exists({ _id: userId });
			if (userExist) {
				// find the spaces where manager im
				const findSpaces = await Space.find({ members: { $elemMatch: { member: userId, role: "manager" } } }).select("_id");

				for (const space of findSpaces) {
					await List.deleteMany({ spaceRef: space._id });
					await SpaceChat.deleteMany({ to: space._id });
					await SpaceFile.deleteMany({ spaceRef: space._id });
					await Call.deleteMany({ space: space._id });
					await Card.deleteMany({ spaceRef: space._id });
					await Checklist.deleteMany({ spaceRef: space._id });
					await CommentChat.deleteMany({ spaceRef: space._id });
				}
				await Space.deleteMany({ members: { $elemMatch: { member: userId, role: "manager" } } });
				await Space.updateMany(
					{ members: { $elemMatch: { member: userId, role: "member" } } },
					{
						$pull: {
							members: {
								member: userId,
							},
						},
					}
				);

				await Workspace.updateOne(
					{ teamMembers: { $elemMatch: { member: userId } } },
					{
						$pull: {
							teamMembers: {
								member: userId,
							},
						},
					}
				);
				await WorkspaceSetting.deleteMany({ user: userId });
				await Notification.deleteMany({ user: userId });
				await Subscription.deleteMany({ user: userId });
				await UserSession.deleteMany({ user: userId });
				await User.deleteOne({ _id: userId });

				res.json({ message: "Your account has been deleted!" });
				return;
			} else {
				issue.userId = "User already may deleted!";
			}
		} else {
			issue.userId = "Invalid Object Id";
		}

		res.status(400).json({ issue });
	} catch (err) {
		next(err);
	}
};
