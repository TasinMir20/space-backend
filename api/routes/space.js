const spaceRouter = require("express").Router();

const { createSpace, getSpace, updateSpace, addMembers, removeMembers, getMembers } = require("../controllers/space");

spaceRouter.post("/", createSpace);
spaceRouter.get("/", getSpace);
spaceRouter.patch("/:spaceId", updateSpace);
spaceRouter.put("/:spaceId/add-members", addMembers);
spaceRouter.put("/:spaceId/remove-members", removeMembers);
spaceRouter.get("/:spaceId/members", getMembers);

module.exports = spaceRouter;
