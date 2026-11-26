import * as tastings from '../services/tastings.js';
import * as standaloneTastings from '../services/standalone-tastings.js';
import * as tastingFlights from '../services/tasting-flights.js';

/**
 * Bottling tastings, standalone tastings and tasting-flight routes.
 * @type {import('./contract.js').ApiRoute[]}
 */
export const tastingsRoutes = [
  {
    method: 'GET',
    path: /^\/api\/tasting-flights$/,
    /**
     * Lists stored tasting sessions, including planned flights.
     * @return {ReturnType<typeof tastingFlights.list>} Tasting flights.
     */
    run: () => tastingFlights.list(),
  },
  {
    method: 'POST',
    path: /^\/api\/tasting-flights$/,
    status: 201,
    /**
     * Creates a tasting session, optionally with a validated plan of physical bottles.
     *
     * @param {string[]} _args Unused route captures.
     * @param {*} body Untrusted JSON: Flight metadata and optional plan.
     * @return {ReturnType<typeof tastingFlights.create>} Created flight.
     */
    run: (_args, body) => tastingFlights.create(body),
  },
  {
    method: 'GET',
    path: /^\/api\/tasting-flights\/([\w-]+)$/,
    /**
     * Looks up the identified tasting session.
     *
     * @param {string[]} items Captured flight identifier or route value.
     * @return {ReturnType<typeof tastingFlights.get>} Requested flight.
     */
    run: ([id]) => tastingFlights.get(id),
  },
  {
    method: 'PATCH',
    path: /^\/api\/tasting-flights\/([\w-]+)$/,
    /**
     * Updates the identified session metadata, lifecycle or planned members.
     *
     * @param {string[]} items Captured flight identifier or route value.
     * @param {*} body Untrusted JSON: Flight changes.
     * @return {ReturnType<typeof tastingFlights.update>} Updated flight.
     */
    run: ([id], body) => tastingFlights.update(id, body),
  },
  {
    method: 'DELETE',
    path: /^\/api\/tasting-flights\/([\w-]+)$/,
    /**
     * Removes the session grouping without duplicating or deleting individual tasting notes.
     *
     * @param {string[]} items Captured flight identifier or route value.
     * @return {ReturnType<typeof tastingFlights.remove>} Flight deletion result.
     */
    run: ([id]) => tastingFlights.remove(id),
  },
  {
    method: 'PUT',
    path: /^\/api\/tasting-flights\/([\w-]+)\/tastings$/,
    /**
     * Replaces the ordered tasting references of the selected flight.
     *
     * @param {string[]} items Captured flight identifier or route value.
     * @param {*} body Untrusted JSON: Ordered tasting IDs.
     * @return {ReturnType<typeof tastingFlights.setTastings>} Updated flight membership.
     */
    run: ([id], body) => tastingFlights.setTastings(id, body),
  },
  {
    method: 'POST',
    path: /^\/api\/tasting-flights\/([\w-]+)\/tastings$/,
    status: 201,
    /**
     * Creates a new tasting and associates it with the selected flight.
     *
     * @param {string[]} items Captured flight identifier or route value.
     * @param {*} body Untrusted JSON: Tasting data and subject selection.
     * @return {ReturnType<typeof tastingFlights.createTasting>} Created tasting and flight update.
     */
    run: ([id], body) => tastingFlights.createTasting(id, body),
  },
  {
    method: 'GET',
    path: /^\/api\/external-tastings$/,
    /**
     * Lists tastings of whiskies not owned as inventory.
     * @return {ReturnType<typeof standaloneTastings.list>} Standalone tastings.
     */
    run: () => standaloneTastings.list(),
  },
  {
    method: 'GET',
    path: /^\/api\/external-tastings\/([\w-]+)$/,
    /**
     * Loads the standalone tasting with its embedded whisky reference.
     *
     * @param {string[]} items Captured standalone tasting identifier or route value.
     * @return {ReturnType<typeof standaloneTastings.get>} Requested standalone tasting.
     */
    run: ([id]) => standaloneTastings.get(id),
  },
  {
    method: 'POST',
    path: /^\/api\/external-tastings$/,
    status: 201,
    /**
     * Creates an independent tasting of a whisky outside the inventory.
     *
     * @param {string[]} _a Unused route captures.
     * @param {*} body Untrusted JSON: Tasting and embedded whisky fields.
     * @return {ReturnType<typeof standaloneTastings.create>} Created standalone tasting.
     */
    run: (_a, body) => standaloneTastings.create(body),
  },
  {
    method: 'PATCH',
    path: /^\/api\/external-tastings\/([\w-]+)$/,
    /**
     * Updates an external tasting and its embedded whisky metadata.
     *
     * @param {string[]} items Captured standalone tasting identifier or route value.
     * @param {*} body Untrusted JSON: Tasting or subject changes.
     * @return {ReturnType<typeof standaloneTastings.update>} Updated standalone tasting.
     */
    run: ([id], body) => standaloneTastings.update(id, body),
  },
  {
    method: 'DELETE',
    path: /^\/api\/external-tastings\/([\w-]+)$/,
    /**
     * Removes the selected standalone tasting.
     *
     * @param {string[]} items Captured standalone tasting identifier or route value.
     * @return {ReturnType<typeof standaloneTastings.remove>} Standalone tasting deletion result.
     */
    run: ([id]) => standaloneTastings.remove(id),
  },
  {
    method: 'POST',
    path: /^\/api\/external-tastings\/([\w-]+)\/assign$/,
    /**
     * Moves the standalone tasting to the selected owned bottling.
     *
     * @param {string[]} items Captured standalone tasting identifier or route value.
     * @param {*} body Untrusted JSON: Target bottling identifier.
     * @return {ReturnType<typeof standaloneTastings.assignToBottling>} Assignment result.
     */
    run: ([id], body) => standaloneTastings.assignToBottling(id, body),
  },
  {
    method: 'GET',
    path: /^\/api\/bottlings\/([\w-]+)\/tastings$/,
    /**
     * Lists recorded tastings of the selected owned release.
     *
     * @param {string[]} items Captured bottling identifier or route value.
     * @return {ReturnType<typeof tastings.listTastings>} Owned tastings for the bottling.
     */
    run: ([id]) => tastings.listTastings(id),
  },
  {
    method: 'GET',
    path: /^\/api\/bottlings\/([\w-]+)\/tastings\/([\w-]+)$/,
    /**
     * Loads an individual tasting from its owning bottling.
     *
     * @param {string[]} items Captured bottling and tasting identifiers or route values, in that order.
     * @return {ReturnType<typeof tastings.getTasting>} Requested tasting.
     */
    run: ([id, tastingId]) => tastings.getTasting(id, tastingId),
  },
  {
    method: 'POST',
    path: /^\/api\/bottlings\/([\w-]+)\/tastings$/,
    status: 201,
    /**
     * Creates an independent dated tasting on the selected release.
     *
     * @param {string[]} items Captured bottling identifier or route value.
     * @param {*} body Untrusted JSON: Tasting fields.
     * @return {ReturnType<typeof tastings.createTasting>} Created tasting.
     */
    run: ([id], body) => tastings.createTasting(id, body),
  },
  {
    method: 'PATCH',
    path: /^\/api\/bottlings\/([\w-]+)\/tastings\/([\w-]+)$/,
    /**
     * Updates the specified tasting without changing its owning release.
     *
     * @param {string[]} items Captured bottling and tasting identifiers or route values, in that order.
     * @param {*} body Untrusted JSON: Tasting changes.
     * @return {ReturnType<typeof tastings.updateTasting>} Updated tasting.
     */
    run: ([id, tastingId], body) => tastings.updateTasting(id, tastingId, body),
  },
  {
    method: 'DELETE',
    path: /^\/api\/bottlings\/([\w-]+)\/tastings\/([\w-]+)$/,
    /**
     * Removes the specified owned tasting and its flight references.
     *
     * @param {string[]} items Captured bottling and tasting identifiers or route values, in that order.
     * @return {ReturnType<typeof tastings.deleteTasting>} Tasting deletion result.
     */
    run: ([id, tastingId]) => tastings.deleteTasting(id, tastingId),
  },
];
