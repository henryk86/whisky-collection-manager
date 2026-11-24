import {request, clearResourceCache} from '../../api.js';
import {escapeHtml} from '../../ui/dom.js';
import {t} from '../../i18n/index.js';
import {toast} from '../../ui/notifications.js';
import {eyeIcon, eyeOffIcon} from '../../ui/action-icons.js';

/**
 * Authentication pages intentionally replace, rather than cover, the
 * collection UI.
 *
 * @param {!Object} options Optional configuration for the operation.
 * @return {!Object} Structured result for the caller.
 */
export function createAuthController({root, state, render, refresh, applyTheme, showModal, closeModal}) {
  let mode = 'login';
  let pendingDelete = null;
  let pendingRequired = null;
  /**
   * Builds the localized tr text for the current language.
   *
   * @param {*} key Key used to select or group values.
   * @return {*} Result computed from the supplied inputs.
   */
  const tr = key => t(`auth.${key}`);

  /**
   * Produces the password toggle text used by the caller.
   *
   * @param {*} id Identifier of the affected record.
   * @param {boolean=} hidden Value used by this operation.
   * @return {string} Resulting text.
   */
  const passwordToggle = (id, hidden = true) =>
    `<button class="auth-password-toggle" type="button" data-act="auth-toggle-password" data-target="${id}" aria-controls="${id}" aria-label="${escapeHtml(tr(hidden ? 'showPassword' : 'hidePassword'))}" title="${escapeHtml(tr(hidden ? 'showPassword' : 'hidePassword'))}" aria-pressed="${hidden ? 'false' : 'true'}">${hidden ? eyeIcon : eyeOffIcon}</button>`;

  /**
   * Produces the field text used by the caller.
   *
   * @param {*} id Identifier of the affected record.
   * @param {*} label Label shown to the user.
   * @param {!Object=} options Options controlling the operation.
   * @return {string} Resulting text.
   */
  const field = (
    id,
    label,
    {type = 'password', autocomplete = 'off', minLength = null, value = ''} = {}
  ) => {
    const isPassword = type === 'password';
    return `<label class="form-field${isPassword ? ' auth-password-field' :
      ''}" for="${id}">${label}${isPassword
        ? `<div class="auth-password-input"><input id="${id}" name="${id}" type="password" autocomplete="${autocomplete}"${minLength ? ` minlength="${minLength}"` : ''}${value ? ` value="${escapeHtml(value)}"` : ''} required>${passwordToggle(id)}</div>`
        : `<input id="${id}" name="${id}" type="${type}" autocomplete="${autocomplete}"${minLength ? ` minlength="${minLength}"` : ''}${value ? ` value="${escapeHtml(value)}"` : ''} required>`}</label>`;
  };

  /**
   * Builds the localized brand text for the current language.
   * @return {string} Resulting text.
   */
  const brand = () => `<div class="auth-brand">
      <img class="auth-brand-logo" src="/assets/logo.svg" width="112" height="112" alt="">
      <div class="auth-brand-copy">
        <span class="brand-overline">${t('ui.branding.privateReserve')}</span>
        <p class="auth-brand-title">${t('ui.branding.whiskyLabel')} <em>${t('ui.branding.collectionLabel')}</em> <span>${t('ui.branding.managerLabel')}</span></p>
      </div>
    </div>`;

  /**
   * Produces the panel text used by the caller.
   *
   * @param {*} title Title displayed or stored by this operation.
   * @param {*} body Body content to validate or process.
   * @return {string} Resulting text.
   */
  const panel = (title, body) =>
    `<div class="auth-page"><section class="panel auth-card">${brand()}<h1>${title}</h1>${body}</section></div>`;

  /**
   * Derives the error text result from the supplied values.
   * @return {string} Resulting text.
   */
  const errorText = () => `<p class="auth-error" role="alert" hidden></p>`;

  /**
   * Produces the error markup text used by the caller.
   *
   * @param {*} text Text to process.
   * @return {string} Resulting text.
   */
  const errorMarkup = text =>
    `<span class="auth-error-icon" aria-hidden="true">!</span><span>${escapeHtml(text)}</span>`;

  /**
   * Renders the controller state.
   */
  function show() {
    if (state.modal) closeModal(true);
    const mandatory = !!state.auth?.user?.mustChangePassword;
    if (mandatory) mode = 'change';
    if (mode === 'change') {
      const canCancel = !mandatory;
      root.innerHTML = panel(tr(mandatory ? 'firstChangeTitle' : 'changeTitle'),
        `<form id="auth-change-form" class="auth-form auth-form-main">
                ${field(
          'currentPassword',
          tr('currentPassword'),
          {autocomplete: 'current-password'}
        )}
                ${field(
          'newPassword',
          tr('newPassword'),
          {autocomplete: 'new-password', minLength: 12}
        )}
                ${field(
          'confirmPassword',
          tr('confirmPassword'),
          {autocomplete: 'new-password', minLength: 12}
        )}
                <p class="muted auth-note">${tr('passwordHint')}</p>${errorText()}
                <div class="actions auth-actions auth-actions--stacked"><button class="btn primary auth-submit" type="submit">${tr('savePassword')}</button>
                ${canCancel ?
          `<button class="btn auth-secondary-action" type="button" data-act="auth-cancel">${tr('cancel')}</button>` : ''}</div></form>`);
    } else {
      root.innerHTML = panel(tr('loginTitle'),
        `<form id="auth-login-form" class="auth-form auth-form-main">
                ${field(
          'username',
          tr('username'),
          {type: 'text', autocomplete: 'username'}
        )}
                ${field(
          'password',
          tr('password'),
          {autocomplete: 'current-password'}
        )}
                ${errorText()}
                <div class="actions auth-actions auth-actions--stacked"><button class="btn primary auth-submit" type="submit">${tr('signIn')}</button>
                ${!state.auth?.required ?
          `<button class="btn auth-secondary-action" type="button" data-act="auth-cancel">${tr('cancel')}</button>` : ''}</div></form>`);
    }
    applyTheme();
    root.querySelector(mandatory || mode === 'change' ? '#currentPassword' :
      '#username')?.focus();
  }

  /**
   * Updates the DOM elements managed by error.
   *
   * @param {*} form Value used by this operation.
   * @param {*} reason Value used by this operation.
   */
  function error(form, reason) {
    const output = form.querySelector('.auth-error');
    if (!output) return;
    let message = tr('failed');
    if (form.id === 'auth-login-form') {
      if (reason?.status === 401 || reason?.code ===
        'api.errors.invalidCredentials') message = tr('invalidCredentials');
      else if (typeof reason?.message === 'string' && reason.message
        .trim()) message = reason.message;
    } else if (typeof reason?.message === 'string' && reason.message
      .trim()) message = reason.message;
    output.innerHTML = errorMarkup(message);
    output.hidden = false;
  }

  /**
   * Coordinates asynchronous work for init.
   * @return {!Promise<*>} Promise for the asynchronous operation.
   */
  async function init() {
    state.auth = await request('/api/auth/session');
    if (state.auth.user?.mustChangePassword) {
      mode =
        'change'; show(); return false;
    }
    if (state.auth.required && !state.auth.user) {
      mode =
        'login'; show(); return false;
    }
    return true;
  }

  /**
   * Performs the open login lifecycle action.
   */
  function openLogin() {mode = 'login'; show();}

  /**
   * Performs the open change lifecycle action.
   */
  function openChange() {mode = 'change'; show();}

  /**
   * Coordinates asynchronous work for resume.
   * @return {!Promise<*>} Promise for the asynchronous operation.
   */
  async function resume() {
    clearResourceCache();
    if (state.auth?.required && !state.auth?.user) {
      mode =
        'login'; state.collection = null; show(); return;
    }
    if (state.auth?.user?.mustChangePassword) {mode = 'change'; show(); return;}
    await refresh();
  }

  /**
   * Coordinates asynchronous work for logout.
   * @return {!Promise<*>} Promise for the asynchronous operation.
   */
  async function logout() {
    state.auth = await request('/api/auth/logout', {method: 'POST'});
    state.authUsers = null;
    state.collection = null;
    await resume();
  }

  /**
   * Updates setting in the current state.
   *
   * @param {*} required Value used by this operation.
   */
  function changeSetting(required) {
    pendingRequired = required;
    showModal(
      tr('loginRequired'),
      `<p>${required ? tr('enableConfirm') : tr('disableConfirm')}</p>
        <div class="actions ds-modal-footer ds-modal-footer--flush"><button class="btn" type="button" data-act="close-modal">${tr('cancel')}</button>
        <button type="button" class="btn primary" data-act="auth-confirm-required">${tr('apply')}</button></div>`
    );
  }

  /**
   * Retrieves users from the available state.
   * @return {!Promise<*>} Promise for the asynchronous operation.
   */
  async function loadUsers() {
    if (!state.auth?.canManageUsers) return;
    const result = await request('/api/auth/users');
    state.authUsers = result.users;
    state.auth.required = result.required;
    const host = root.querySelector('#auth-users-content');
    if (host) host.innerHTML = usersSection();
    else render();
  }

  /**
   * Transforms the entries used by users section.
   * @return {string} Resulting text.
   */
  function usersSection() {
    if (!state.auth?.canManageUsers) return '';
    const users = state.authUsers || [];
    return `<div class="panel section auth-settings">
        <h3>${tr('loginRequired')}</h3><p class="muted">${tr('loginSettingDescription')}</p>
        <div class="auth-setting-row"><strong>${state.auth.required ?
        tr('enabled') : tr('disabled')}</strong>
        <button class="btn" type="button" data-act="auth-toggle-required">${state.auth.required ? tr('disable') : tr('enable')}</button></div></div>
        <div class="panel section auth-settings"><h3>${tr('users')}</h3>
        <div class="auth-user-list" role="list">${users.map(user =>
          `<div class="auth-user-row" role="listitem">
            <div><strong>${escapeHtml(user.username)}</strong><span class="muted">${user.role === 'admin' ? tr('administrator') : tr('standardUser')}${user.mustChangePassword ? ' · ' + tr('changePending') : ''}</span></div>
            ${user.id !== state.auth.user.id ?
            `<div class="actions"><button type="button" class="btn small" data-act="auth-reset-user" data-id="${escapeHtml(user.id)}">${tr('resetPassword')}</button>
            <button type="button" class="btn small danger" data-act="auth-delete-user" data-id="${escapeHtml(user.id)}">${tr('delete')}</button></div>` : ''}
        </div>`).join('')}</div>
        <h3 class="auth-subtitle">${tr('createUser')}</h3>
        <form id="auth-create-form" class="auth-form auth-create-form">
        ${field(
              'username',
              tr('username'),
              {type: 'text', autocomplete: 'off'}
            )}
        ${field(
              'password',
              tr('temporaryPassword'),
              {autocomplete: 'new-password', minLength: 12}
            )}
        <p class="muted">${tr('newUserHint')}</p><button class="btn primary" type="submit">${tr('createUser')}</button></form>
        </div>`;
  }

  /**
   * Handles action for controller.
   *
   * @param {*} button Button used by this operation.
   */
  async function handleAction(button) {
    const act = button.dataset.act;
    if (act === 'auth-open-login') openLogin();
    else if (act === 'auth-logout') await logout();
    else if (act === 'auth-open-change') openChange();
    else if (act === 'auth-cancel') await resume();
    else if (act === 'auth-toggle-required') changeSetting(!state.auth
      .required);
    else if (act === 'auth-toggle-password') {
      const input = document.getElementById(button.dataset.target || '');
      if (!input) return;
      const hidden = input.type === 'password';
      input.type = hidden ? 'text' : 'password';
      button.innerHTML = hidden ? eyeOffIcon : eyeIcon;
      button.setAttribute(
        'aria-label',
        tr(hidden ? 'hidePassword' : 'showPassword')
      );
      button.setAttribute(
        'title',
        tr(hidden ? 'hidePassword' : 'showPassword')
      );
      button.setAttribute('aria-pressed', hidden ? 'true' : 'false');
    } else if (act === 'auth-confirm-required') {
      if (typeof pendingRequired !== 'boolean') return;
      const value = pendingRequired; pendingRequired = null;
      const result = await request(
        '/api/auth/config',
        {method: 'PATCH', body: JSON.stringify({required: value})}
      );
      state.auth.required = result.required;
      closeModal();
      await loadUsers();
    } else if (act === 'auth-reset-user') {
      const user = state.authUsers?.find(u => u.id === button.dataset.id);
      if (!user) return;
      showModal(tr('resetPassword'), `<p>${escapeHtml(user.username)}</p>
              <form id="auth-reset-form" class="auth-form" data-user-id="${escapeHtml(user.id)}">
              ${field(
        'password',
        tr('temporaryPassword'),
        {autocomplete: 'new-password', minLength: 12}
      )}
              <p class="muted">${tr('newUserHint')}</p>
              <div class="actions"><button class="btn" type="button" data-act="close-modal">${tr('cancel')}</button>
              <button class="btn primary" type="submit">${tr('apply')}</button></div></form>`);
    } else if (act === 'auth-delete-user') {
      const user = state.authUsers?.find(u => u.id === button.dataset.id);
      if (!user) return;
      pendingDelete = user.id;
      showModal(
        tr('deleteUser'),
        `<p>${tr('deleteConfirm')} <strong>${escapeHtml(user.username)}</strong>?</p>
            <div class="actions"><button class="btn" type="button" data-act="close-modal">${tr('cancel')}</button>
            <button class="btn danger" type="button" data-act="auth-confirm-delete">${tr('delete')}</button></div>`
      );
    } else if (act === 'auth-confirm-delete') {
      if (!pendingDelete) return;
      const id = pendingDelete; pendingDelete = null;
      await request(
        `/api/auth/users/${encodeURIComponent(id)}`,
        {method: 'DELETE'}
      );
      closeModal(); await loadUsers();
    }
  }

  /**
   * Handles submit for controller.
   *
   * @param {!KeyboardEvent} event Event that triggered the handler.
   * @return {boolean} Whether the condition is satisfied.
   */
  function handleSubmit(event) {
    const form = event.target;
    if (![
      'auth-login-form',
      'auth-change-form',
      'auth-create-form',
      'auth-reset-form',
    ].includes(form.id)) return false;
    event.preventDefault();
    const submit = form.querySelector('button[type="submit"]');
    if (submit?.disabled) return true;
    if (submit) submit.disabled = true;
    const output = form.querySelector('.auth-error');
    if (output) {output.hidden = true; output.textContent = '';}
    (async () => {
      if (form.id === 'auth-login-form') {
        state.auth = await request(
          '/api/auth/login',
          {
            method: 'POST',
            body: JSON.stringify({
              username: form.elements.username.value,
              password: form.elements.password.value,
            }),
          }
        );
        form.elements.password.value = '';
        await resume();
      } else if (form.id === 'auth-change-form') {
        if (form.elements.newPassword.value !== form.elements
          .confirmPassword.value) throw Error(tr('passwordMismatch'));
        state.auth = await request(
          '/api/auth/password',
          {
            method: 'POST',
            body: JSON.stringify({
              currentPassword: form.elements.currentPassword.value,
              newPassword: form.elements.newPassword.value,
            }),
          }
        );
        await resume();
        toast(tr('passwordSaved'));
      } else if (form.id === 'auth-create-form') {
        await request(
          '/api/auth/users',
          {
            method: 'POST',
            body: JSON.stringify({
              username: form.elements.username.value,
              password: form.elements.password.value,
            }),
          }
        );
        await loadUsers(); toast(tr('userCreated'));
      } else if (form.id === 'auth-reset-form') {
        await request(
          `/api/auth/users/${encodeURIComponent(form.dataset
            .userId)}/reset-password`,
          {
            method: 'POST',
            body: JSON.stringify({password: form.elements.password.value}),
          }
        );
        closeModal(); await loadUsers(); toast(tr('passwordReset'));
      }
    })().catch(reason => {
      if (form.id === 'auth-login-form' || form.id ===
        'auth-change-form') error(form, reason);
      else toast(reason.message, true);
    }).finally(() => {if (submit.isConnected) submit.disabled = false;});
    return true;
  }
  return {
    init,
    openLogin,
    openChange,
    resume,
    logout,
    loadUsers,
    usersSection,
    handleAction,
    handleSubmit,
  };
}
