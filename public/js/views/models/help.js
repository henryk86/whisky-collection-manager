import {t} from '../../i18n/index.js';

/**
 * Prepares localized help topics and the active selection.
 * @param {!Array<!Object>} topics Available help topics.
 * @param {string} activeTopic Requested topic identifier.
 * @return {!Object} Selected topic and translated entries.
 */
export function createHelpViewModel(topics, activeTopic) {
  const current = topics.some(topic => topic.id === activeTopic) ?
    activeTopic : 'basics';
  return {
    current, topics: topics.map(topic => ({
      id: topic.id,
      label: t(`help.${topic.id}.title`),
      entries: Array.from({length: topic.items}, (_, index) =>
        t(`help.${topic.id}.${index + 1}`)),
    })),
  };
}
