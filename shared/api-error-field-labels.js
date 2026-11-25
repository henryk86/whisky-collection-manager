/**
 * English display names for whitelisted, locale-neutral API field identifiers.
 */
export const apiErrorFieldLabels = Object.freeze({
  "name": "Name",
  "distilleryName": "Distillery name",
  "ageYears": "Age (years)",
  "releaseYear": "Release year",
  "distillationYear": "Distillation year",
  "bottlingYear": "Bottling year",
  "distillationDate": "Distillation date",
  "bottlingDate": "Bottling date",
  "abv": "ABV",
  "volumeMl": "Volume (ml)",
  "limitedEditionCount": "Limited-edition count",
  "x": "Position X",
  "y": "Position Y",
  "width": "Width",
  "depth": "Depth",
  "elevation": "Elevation above floor",
  "itemHeight": "Furniture height",
  "leftSidePanel": "Left side panel",
  "rightSidePanel": "Right side panel",
  "backPanel": "Back panel",
  "provider": "Provider",
  "remote": "Rclone remote",
  "targetPath": "Destination path",
  "scheduleHour": "Hour",
  "scheduleMinute": "Minute",
  "scheduleWeekday": "Weekday",
  "retentionDaily": "Daily retention",
  "retentionWeekly": "Weekly retention",
  "retentionMonthly": "Monthly retention",
});

/**
 * Renders error params for api error field labels.
 *
 * @param {*} params Named values used when formatting the message.
 * @param {Function=} translate Translate used by this operation.
 * @return {!Object} Structured result for the caller.
 */
export function displayErrorParams(
  params,
  translate = key => apiErrorFieldLabels[key.slice('api.fields.'.length)]
) {
  return Object.fromEntries(Object.entries(params).map(([name, value]) => {
    if ((name === 'field' || name === 'other') && Object.hasOwn(apiErrorFieldLabels, value)) {
      return [name, translate(`api.fields.${value}`) || apiErrorFieldLabels[value]];
    }
    return [name, value];
  }));
}
