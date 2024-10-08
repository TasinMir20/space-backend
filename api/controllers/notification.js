const Notification = require("../../models/Notification");

exports.notificationsGet = async (req, res, next) => {
	let { limit, skip, unseen } = req.query;
	try {
		const user = req.user;
		limit = parseInt(limit) || 20;
		skip = parseInt(skip) || 0;

		let query = { user: user._id };
		if (unseen) {
			query.seen = false;
		}

		const getNotifications = await Notification.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit);
		res.json({ notifications: getNotifications });

		const ids = getNotifications.map((item) => item._id);
		await Notification.updateMany({ $and: [{ user: user._id }, { seen: false }, { $inc: { _id: ids } }] }, { seen: true });
	} catch (err) {
		next(err);
	}
};
