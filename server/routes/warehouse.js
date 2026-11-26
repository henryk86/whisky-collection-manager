import * as warehouse from '../services/warehouse.js';
import {fail} from '../domain/errors.js';

/**
 * Room, furniture, shelf and physical bottle assignment routes. Literal bulk actions precede identifier routes.
 * @type {import('./contract.js').ApiRoute[]}
 */
export const warehouseRoutes = [
  {
    method: 'GET',
    path: /^\/api\/warehouse$/,
    cacheResource: 'warehouse',
    /**
     * Loads the current warehouse, including its projected inventory.
     * @return {ReturnType<typeof warehouse.getWarehouse>} Current warehouse state.
     */
    run: () => warehouse.getWarehouse(),
  },
  {
    method: 'POST',
    path: /^\/api\/warehouse\/rooms\/export$/,
    /**
     * Exports selected room layouts with optional inventory assignments.
     *
     * @param {string[]} _ Unused route captures.
     * @param {*} body Untrusted JSON: Room IDs and assignment inclusion option.
     * @return {ReturnType<typeof warehouse.exportRooms>} Room-transfer document.
     */
    run: (_, body) => warehouse.exportRooms(body),
  },
  {
    method: 'POST',
    path: /^\/api\/warehouse\/rooms\/import\/preview$/,
    /**
     * Computes import conflicts and a preview without committing warehouse changes.
     *
     * @param {string[]} _ Unused route captures.
     * @param {*} body Untrusted JSON: Room-transfer document and conflict/assignment options.
     * @return {ReturnType<typeof warehouse.previewRoomImport>} Proposed import summary.
     */
    run: (_, body) => warehouse.previewRoomImport(body),
  },
  {
    method: 'POST',
    path: /^\/api\/warehouse\/rooms\/import$/,
    /**
     * Applies the validated room transfer in a warehouse mutation.
     *
     * @param {string[]} _ Unused route captures.
     * @param {*} body Untrusted JSON: Room-transfer document and conflict/assignment options.
     * @return {ReturnType<typeof warehouse.importRooms>} Committed import summary.
     */
    run: (_, body) => warehouse.importRooms(body),
  },
  {
    method: 'POST',
    path: /^\/api\/warehouse\/rooms$/,
    status: 201,
    /**
     * Adds a storage room after its dimensions and name are validated.
     *
     * @param {string[]} _ Unused route captures.
     * @param {*} body Untrusted JSON: New room fields.
     * @return {ReturnType<typeof warehouse.createRoom>} Created room.
     */
    run: (_, body) => warehouse.createRoom(body),
  },
  {
    method: 'PATCH',
    path: /^\/api\/warehouse\/rooms\/([\w-]+)$/,
    /**
     * Updates the selected room while retaining layout constraints.
     *
     * @param {string[]} items Captured room identifier or route value.
     * @param {*} body Untrusted JSON: Room changes.
     * @return {ReturnType<typeof warehouse.updateRoom>} Updated room.
     */
    run: ([id], body) => warehouse.updateRoom(id, body),
  },
  {
    method: 'DELETE',
    path: /^\/api\/warehouse\/rooms\/([\w-]+)$/,
    /**
     * Deletes the selected room; the query option controls whether assigned bottles may be unassigned.
     *
     * @param {string[]} items Captured room identifier or route value.
     * @param {*} _body Unused parsed request body.
     * @param {import('node:http').IncomingMessage} req Incoming request used for authorization or request metadata.
     * @return {ReturnType<typeof warehouse.deleteRoom>} Room deletion result.
     * @throws {import('../domain/errors.js').HttpError} HTTP 400 for an invalid unassignBottles query value.
     */
    run: ([id], _body, req) => {
      const option = new URL(req.url, 'http://localhost').searchParams.get('unassignBottles');
      if (option !== null && option !== 'true' && option !== 'false') throw fail('Ungültige Löschoption', 400, "api.errors.invalidDeletionOption");
      return warehouse.deleteRoom(id, {unassignBottles: option === 'true'});
    },
  },
  {
    method: 'POST',
    path: /^\/api\/warehouse\/rooms\/([\w-]+)\/furniture$/,
    status: 201,
    /**
     * Creates a furniture item inside the identified room.
     *
     * @param {string[]} items Captured room identifier or route value.
     * @param {*} body Untrusted JSON: Furniture layout fields.
     * @return {ReturnType<typeof warehouse.createFurniture>} Created furniture item.
     */
    run: ([id], body) => warehouse.createFurniture(id, body),
  },
  {
    method: 'PATCH',
    path: /^\/api\/warehouse\/furniture\/bulk$/,
    /**
     * Applies selected bulk furniture changes together.
     *
     * @param {string[]} _ Unused route captures.
     * @param {*} body Untrusted JSON: Selected furniture IDs and update fields.
     * @return {ReturnType<typeof warehouse.bulkUpdateFurniture>} Bulk mutation result.
     */
    run: (_, body) => warehouse.bulkUpdateFurniture(body),
  },
  {
    method: 'POST',
    path: /^\/api\/warehouse\/furniture\/bulk\/delete$/,
    /**
     * Deletes the selected furniture in a bulk mutation.
     *
     * @param {string[]} _ Unused route captures.
     * @param {*} body Untrusted JSON: Selected furniture IDs and deletion options.
     * @return {ReturnType<typeof warehouse.bulkDeleteFurniture>} Bulk deletion result.
     */
    run: (_, body) => warehouse.bulkDeleteFurniture(body),
  },
  {
    method: 'PATCH',
    path: /^\/api\/warehouse\/furniture\/([\w-]+)$/,
    /**
     * Updates the selected furniture layout and configuration.
     *
     * @param {string[]} items Captured furniture identifier or route value.
     * @param {*} body Untrusted JSON: Furniture changes.
     * @return {ReturnType<typeof warehouse.updateFurniture>} Updated furniture item.
     */
    run: ([id], body) => warehouse.updateFurniture(id, body),
  },
  {
    method: 'DELETE',
    path: /^\/api\/warehouse\/furniture\/([\w-]+)$/,
    /**
     * Deletes the selected furniture subject to assignment constraints.
     *
     * @param {string[]} items Captured furniture identifier or route value.
     * @return {ReturnType<typeof warehouse.deleteFurniture>} Furniture deletion result.
     */
    run: ([id]) => warehouse.deleteFurniture(id),
  },
  {
    method: 'POST',
    path: /^\/api\/warehouse\/furniture\/([\w-]+)\/photos$/,
    status: 201,
    /**
     * Stores a photo for the selected furniture item.
     *
     * @param {string[]} items Captured furniture identifier or route value.
     * @param {*} body Untrusted JSON: Encoded image data.
     * @return {ReturnType<typeof warehouse.addFurniturePhoto>} Added furniture photo.
     */
    run: ([id], body) => warehouse.addFurniturePhoto(id, body),
  },
  {
    method: 'PUT',
    path: /^\/api\/warehouse\/furniture\/([\w-]+)\/photos\/order$/,
    /**
     * Persists the requested order of existing furniture photos.
     *
     * @param {string[]} items Captured furniture identifier or route value.
     * @param {*} body Untrusted JSON: Ordered photo IDs.
     * @return {ReturnType<typeof warehouse.reorderFurniturePhotos>} Updated photo order.
     */
    run: ([id], body) => warehouse.reorderFurniturePhotos(id, body),
  },
  {
    method: 'DELETE',
    path: /^\/api\/warehouse\/furniture\/([\w-]+)\/photos\/([\w-]+)$/,
    /**
     * Removes a specified photo from its owning furniture item.
     *
     * @param {string[]} items Captured furniture and photo identifiers or route values, in that order.
     * @return {ReturnType<typeof warehouse.deleteFurniturePhoto>} Furniture photo deletion result.
     */
    run: ([id, photoId]) => warehouse.deleteFurniturePhoto(id, photoId),
  },
  {
    method: 'POST',
    path: /^\/api\/warehouse\/furniture\/([\w-]+)\/copy$/,
    status: 201,
    /**
     * Copies the selected furniture into the requested storage location.
     *
     * @param {string[]} items Captured furniture identifier or route value.
     * @param {*} body Untrusted JSON: Copy destination and options.
     * @return {ReturnType<typeof warehouse.copyFurniture>} Copied furniture item.
     */
    run: ([id], body) => warehouse.copyFurniture(id, body),
  },
  {
    method: 'POST',
    path: /^\/api\/warehouse\/furniture\/([\w-]+)\/shelves$/,
    status: 201,
    /**
     * Creates a compartment in the selected furniture item.
     *
     * @param {string[]} items Captured furniture identifier or route value.
     * @param {*} body Untrusted JSON: Shelf configuration.
     * @return {ReturnType<typeof warehouse.createShelf>} Created shelf.
     */
    run: ([id], body) => warehouse.createShelf(id, body),
  },
  {
    method: 'PATCH',
    path: /^\/api\/warehouse\/shelves\/([\w-]+)\/move$/,
    /**
     * Moves a shelf according to the requested target and ordering.
     *
     * @param {string[]} items Captured shelf identifier or route value.
     * @param {*} body Untrusted JSON: Target compartment position.
     * @return {ReturnType<typeof warehouse.moveShelf>} Shelf movement result.
     */
    run: ([id], body) => warehouse.moveShelf(id, body),
  },
  {
    method: 'PATCH',
    path: /^\/api\/warehouse\/shelves\/([\w-]+)$/,
    /**
     * Updates a shelf’s name, capacity or front and height settings.
     *
     * @param {string[]} items Captured shelf identifier or route value.
     * @param {*} body Untrusted JSON: Shelf changes.
     * @return {ReturnType<typeof warehouse.updateShelf>} Updated shelf.
     */
    run: ([id], body) => warehouse.updateShelf(id, body),
  },
  {
    method: 'DELETE',
    path: /^\/api\/warehouse\/shelves\/([\w-]+)$/,
    /**
     * Removes the selected shelf subject to storage constraints.
     *
     * @param {string[]} items Captured shelf identifier or route value.
     * @return {ReturnType<typeof warehouse.deleteShelf>} Shelf deletion result.
     */
    run: ([id]) => warehouse.deleteShelf(id),
  },
  {
    method: 'POST',
    path: /^\/api\/warehouse\/shelves\/([\w-]+)\/copy$/,
    status: 201,
    /**
     * Copies the selected shelf to the requested furniture or position.
     *
     * @param {string[]} items Captured shelf identifier or route value.
     * @param {*} body Untrusted JSON: Copy destination and options.
     * @return {ReturnType<typeof warehouse.copyShelf>} Copied shelf.
     */
    run: ([id], body) => warehouse.copyShelf(id, body),
  },
  {
    method: 'POST',
    path: /^\/api\/warehouse\/bottles\/bulk$/,
    /**
     * Applies a batch of physical bottle location assignments.
     *
     * @param {string[]} _ Unused route captures.
     * @param {*} body Untrusted JSON: Physical bottle IDs and target assignments.
     * @return {ReturnType<typeof warehouse.assignBottles>} Assignment mutation result.
     */
    run: (_, body) => warehouse.assignBottles(body),
  },
  {
    method: 'PUT',
    path: /^\/api\/warehouse\/bottles\/([\w-]+)$/,
    /**
     * Assigns or unassigns the selected physical bottle.
     *
     * @param {string[]} items Captured bottle identifier or route value.
     * @param {*} body Untrusted JSON: Requested storage location.
     * @return {ReturnType<typeof warehouse.assignBottle>} Updated bottle assignment.
     */
    run: ([id], body) => warehouse.assignBottle(id, body),
  },
];
