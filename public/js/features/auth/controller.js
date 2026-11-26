import {composeMarkup} from '../../ui/render-plan.js';
import {replaceContent} from '../../ui/dom-renderer.js';
import {actionButton} from '../../ui/buttons.js';
import {request, clearResourceCache} from '../../api.js';
import {t} from '../../i18n/index.js';
import {toast} from '../../ui/notifications.js';
import {eyeIcon, eyeOffIcon} from '../../ui/action-icons.js';
import {loadTemplates} from '../../ui/templates.js';

const renderTemplate = await loadTemplates('auth/controller.html');


/**
 * Authentication pages intentionally replace, rather than cover, the
 * collection UI.
 *
 * @param {!Object} options Optional configuration for the operation.
 * @return {!Object} Structured result for the caller.
 */
export function createAuthController({root, state, render, refresh, applyTheme,
  showModal, closeModal}) {
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
   * Prepares password visibility toggle associated with the target input.
   *
   * @param {*} id Identifier of the affected record.
   * @param {boolean=} hidden Whether the password is currently concealed.
   * @return {!import('../../ui/render-plan.js').RenderPlan} Password visibility toggle associated with the target input.
   */
  const passwordToggle = (id, hidden = true) =>
    renderTemplate('authTogglePassword', {
      id: id,
      ariaControls: id,
      tr: tr(hidden ? 'showPassword' : 'hidePassword'),
      title: tr(hidden ? 'showPassword' : 'hidePassword'),
      hidden: hidden ? 'false' : 'true',
      visibilityIcon: hidden ? eyeIcon : eyeOffIcon,
    });

  /**
   * Prepares labeled authentication input, including a visibility toggle for passwords.
   *
   * @param {*} id Identifier of the affected record.
   * @param {*} label Label shown to the user.
   * @param {!Object=} options Options controlling the operation.
   * @return {!import('../../ui/render-plan.js').RenderPlan} Labeled authentication input, including a visibility toggle for passwords.
   */
  const field = (
    id,
    label,
    {type = 'password', autocomplete = 'off', minLength = null, value = ''} = {}
  ) => {
    const isPassword = type === 'password';
    return renderTemplate('formField', {
      isPassword: isPassword ? ' auth-password-field' : '',
      id: id,
      label: label,
      authPasswordInput: isPassword
        ? renderTemplate('authPasswordInput', {
          id: id,
          name: id,
          autocomplete: autocomplete,
          minlengthAttributes: minLength ? {"minlength": minLength} : {},
          valueAttributes: value ? {"value": value} : {},
          passwordToggle: passwordToggle(id),
        })
        : renderTemplate('fieldInput', {
          id: id,
          name: id,
          type: type,
          autocomplete: autocomplete,
          minlengthAttributes: minLength ? {"minlength": minLength} : {},
          valueAttributes: value ? {"value": value} : {},
        }),
    });
  };

  /**
   * Prepares application branding for the authentication screen.
   * @return {!import('../../ui/render-plan.js').RenderPlan} Application branding for the authentication screen.
   */
  const brand = () => renderTemplate('authBrand');

  /**
   * Prepares authentication page containing the supplied form and title.
   *
   * @param {*} title Title displayed or stored by this operation.
   * @param {*} body Body content to validate or process.
   * @return {!import('../../ui/render-plan.js').RenderPlan} Authentication page containing the supplied form and title.
   */
  const panel = (title, body) =>
    renderTemplate('authPage', {
      brand: brand(),
      title: title,
      body: body,
    });

  /**
   * Prepares initially hidden authentication error region.
   * @return {!import('../../ui/render-plan.js').RenderPlan} Initially hidden authentication error region.
   */
  const errorText = () => renderTemplate('authError');

  /**
   * Prepares authentication error message with its status icon.
   *
   * @param {*} text Text to process.
   * @return {!import('../../ui/render-plan.js').RenderPlan} Authentication error message with its status icon.
   */
  const errorMarkup = text => renderTemplate('authErrorIcon', {text: text, });

  /**
   * Renders the controller state.
   */
  function show() {
    if (state.modal) closeModal(true);
    const mandatory = !!state.auth?.user?.mustChangePassword;
    if (mandatory) mode = 'change';
    if (mode === 'change') {
      const canCancel = !mandatory;
      replaceContent(
        root,
        panel(
          tr(mandatory ? 'firstChangeTitle' : 'changeTitle'),
          renderTemplate('authChangeForm', {
            field: field('currentPassword', tr('currentPassword'), {autocomplete: 'current-password'}),
            newPasswordField: field('newPassword', tr('newPassword'), {autocomplete: 'new-password', minLength: 12}),
            confirmPasswordField: field('confirmPassword', tr('confirmPassword'), {autocomplete: 'new-password', minLength: 12}),
            passwordHint: tr('passwordHint'),
            errorText: errorText(),
            savePassword: tr('savePassword'),
            canCancel: canCancel ?
              actionButton({
                label: tr('cancel'),
                action: 'auth-cancel',
                className: 'auth-secondary-action',
              }) : '',
          })
        )
      );
    } else {
      replaceContent(root, panel(tr('loginTitle'),
        renderTemplate('authLoginForm', {
          field: field('username', tr('username'), {type: 'text', autocomplete: 'username'}),
          passwordField: field('password', tr('password'), {autocomplete: 'current-password'}),
          errorText: errorText(),
          signIn: tr('signIn'),
          content: !state.auth?.required ?
            actionButton({
              label: tr('cancel'),
              action: 'auth-cancel',
              className: 'auth-secondary-action',
            }) : '',
        })));
    }
    applyTheme();
    root.querySelector(mandatory || mode === 'change' ? '#currentPassword' : '#username')?.focus();
  }

  /**
   * Updates the DOM elements managed by error.
   *
   * @param {*} form Login or password form containing the error output.
   * @param {*} reason Request failure carrying status and API error code, when available.
   */
  function error(form, reason) {
    const output = form.querySelector('.auth-error');
    if (!output) return;
    let message = tr('failed');
    if (form.id === 'auth-login-form') {
      if (reason?.status === 401 || reason?.code === 'api.errors.invalidCredentials') message = tr('invalidCredentials');
      else if (typeof reason?.message === 'string' && reason.message.trim()) message = reason.message;
    } else if (typeof reason?.message === 'string' && reason.message.trim()) message = reason.message;
    replaceContent(output, errorMarkup(message));
    output.hidden = false;
  }

  /**
   * Coordinates asynchronous work for init.
   * @return {!Promise<*>} Promise for the asynchronous operation.
   */
  async function init() {
    state.auth = await request('/api/auth/session');
    if (state.auth.user?.mustChangePassword) {
      mode = 'change'; show(); return false;
    }
    if (state.auth.required && !state.auth.user) {
      mode = 'login'; show(); return false;
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
      mode = 'login'; state.collection = null; show(); return;
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
   * @param {boolean} required Whether authentication should become mandatory.
   */
  function changeSetting(required) {
    pendingRequired = required;
    showModal(
      tr('loginRequired'),
      renderTemplate('changeSettingP', {
        required: required ? tr('enableConfirm') : tr('disableConfirm'),
        closeModalButton: actionButton({
          label: tr('cancel'),
          action: 'close-modal',
        }),
        authConfirmRequiredButton: actionButton({
          label: tr('apply'),
          action: 'auth-confirm-required',
          variant: 'primary',
        }),
      })
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
    if (host) replaceContent(host, usersSection());
    else render();
  }

  /**
   * Prepares user administration panel with account actions.
   * @return {import('../../ui/render-plan.js').RenderPlan|string} User administration panel with account actions (or scalar/empty text when no plan is needed).
   */
  function usersSection() {
    if (!state.auth?.canManageUsers) return '';
    const users = state.authUsers || [];
    return renderTemplate('panel', {
      loginRequired: tr('loginRequired'),
      loginSettingDescription: tr('loginSettingDescription'),
      required: state.auth.required ? tr('enabled') : tr('disabled'),
      authToggleRequiredButton: actionButton({
        label: state.auth.required ? tr('disable') : tr('enable'),
        action: 'auth-toggle-required',
      }),
      users: tr('users'),
      userList: composeMarkup(users.map(user =>
        renderTemplate('authUserRow', {
          username: user.username,
          role: user.role === 'admin' ? tr('administrator') : tr('standardUser'),
          mustChangePassword: user.mustChangePassword ? ' · ' + tr('changePending') : '',
          authResetUser: user.id !== state.auth.user.id ?
            renderTemplate('authResetUser', {
              id: user.id,
              resetPassword: tr('resetPassword'),
              deleteUserId: user.id,
              delete: tr('delete'),
            }) : '',
        }))),
      createUser: tr('createUser'),
      field: field('username', tr('username'), {type: 'text', autocomplete: 'off'}),
      temporaryPasswordField: field('password', tr('temporaryPassword'), {autocomplete: 'new-password', minLength: 12}),
      newUserHint: tr('newUserHint'),
      createUserButtonLabel: tr('createUser'),
    });
  }

  /**
   * Handles action for controller.
   *
   * @param {*} button Clicked authentication action control with a data-act attribute.
   */
  async function handleAction(button) {
    const act = button.dataset.act;
    if (act === 'auth-open-login') openLogin();
    else if (act === 'auth-logout') await logout();
    else if (act === 'auth-open-change') openChange();
    else if (act === 'auth-cancel') await resume();
    else if (act === 'auth-toggle-required') changeSetting(!state.auth.required);
    else if (act === 'auth-toggle-password') {
      const input = document.getElementById(button.dataset.target || '');
      if (!input) return;
      const hidden = input.type === 'password';
      input.type = hidden ? 'text' : 'password';
      replaceContent(button, hidden ? eyeOffIcon : eyeIcon);
      button.setAttribute('aria-label', tr(hidden ? 'hidePassword' : 'showPassword'));
      button.setAttribute('title', tr(hidden ? 'hidePassword' : 'showPassword'));
      button.setAttribute('aria-pressed', hidden ? 'true' : 'false');
    } else if (act === 'auth-confirm-required') {
      if (typeof pendingRequired !== 'boolean') return;
      const value = pendingRequired; pendingRequired = null;
      const result = await request('/api/auth/config', {method: 'PATCH', body: JSON.stringify({required: value})});
      state.auth.required = result.required;
      closeModal();
      await loadUsers();
    } else if (act === 'auth-reset-user') {
      const user = state.authUsers?.find(u => u.id === button.dataset.id);
      if (!user) return;
      showModal(tr('resetPassword'), renderTemplate('handleActionP', {
        username: user.username,
        id: user.id,
        field: field('password', tr('temporaryPassword'), {autocomplete: 'new-password', minLength: 12}),
        newUserHint: tr('newUserHint'),
        closeModalButton: actionButton({
          label: tr('cancel'),
          action: 'close-modal',
        }),
        apply: tr('apply'),
      }));
    } else if (act === 'auth-delete-user') {
      const user = state.authUsers?.find(u => u.id === button.dataset.id);
      if (!user) return;
      pendingDelete = user.id;
      showModal(
        tr('deleteUser'),
        renderTemplate('handleActionP2', {
          deleteConfirm: tr('deleteConfirm'),
          username: user.username,
          closeModalButton: actionButton({
            label: tr('cancel'),
            action: 'close-modal',
          }),
          authConfirmDeleteButton: actionButton({
            label: tr('delete'),
            action: 'auth-confirm-delete',
            variant: 'destructive',
          }),
        })
      );
    } else if (act === 'auth-confirm-delete') {
      if (!pendingDelete) return;
      const id = pendingDelete; pendingDelete = null;
      await request(`/api/auth/users/${encodeURIComponent(id)}`, {method: 'DELETE'});
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
        if (form.elements.newPassword.value !== form.elements.confirmPassword.value) throw Error(tr('passwordMismatch'));
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
          `/api/auth/users/${encodeURIComponent(form.dataset.userId)}/reset-password`,
          {
            method: 'POST',
            body: JSON.stringify({password: form.elements.password.value}),
          }
        );
        closeModal(); await loadUsers(); toast(tr('passwordReset'));
      }
    })().catch(reason => {
      if (form.id === 'auth-login-form' || form.id === 'auth-change-form') error(form, reason);
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
