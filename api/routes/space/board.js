const multipart = require("connect-multiparty");
const boardRouter = require("express").Router({ mergeParams: true });

const { createList, getLists, editList, deleteList, orderOrSortList, createCard, getCards, getSingleCard, updateCard, moveCard, copyCard, deleteCard, orderOrSortCard, createChecklistItem, updateChecklistItem, deleteChecklistItem, createComment, getComments, commentsEdit, commentsDelete, commentsReaction } = require("../../controllers/space/board");

boardRouter.post("/", createList);
boardRouter.get("/", getLists);
boardRouter.patch("/:listId", editList);
boardRouter.delete("/:listId", deleteList);
boardRouter.put("/:listId/order", orderOrSortList);

///////// CARD ///////////////
boardRouter.post("/:listId/card", createCard);
boardRouter.get("/:listId/card", getCards);
boardRouter.get("/:listId/card/:cardId", getSingleCard);
boardRouter.patch("/:listId/card/:cardId", multipart(), updateCard);
boardRouter.delete("/:listId/card/:cardId", deleteCard);
boardRouter.put("/:listId/card/:cardId/move", moveCard);
boardRouter.copy("/:listId/card/:cardId/copy", copyCard);
boardRouter.put("/:listId/card/:cardId/order", orderOrSortCard);

///////// CARD Checklist ///////////////
boardRouter.post("/:listId/card/:cardId/checklist", createChecklistItem);
boardRouter.patch("/:listId/card/:cardId/checklist/:checklistId", updateChecklistItem);
boardRouter.delete("/:listId/card/:cardId/checklist/:checklistId", deleteChecklistItem);

///////// Comments ///////////////
boardRouter.post("/:listId/card/:cardId/comment", multipart(), createComment);
boardRouter.get("/:listId/card/:cardId/comment", getComments);
boardRouter.patch("/:listId/card/:cardId/comment/:commentId", commentsEdit);
boardRouter.delete("/:listId/card/:cardId/comment/:commentId", commentsDelete);
boardRouter.put("/:listId/card/:cardId/comment/:commentId", commentsReaction);

module.exports = boardRouter;
