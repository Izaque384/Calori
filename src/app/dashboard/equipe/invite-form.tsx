"use client";

import { useActionState } from "react";
import { createTeamInvite } from "./actions";

export default function InviteForm() {
  const [state, action, pending] = useActionState(createTeamInvite, null);

  return (
    <div className="team-invite-box">
      <form action={action} className="team-invite-form">
        <label>
          E-mail
          <input name="email" type="email" placeholder="pessoa@restaurante.com" required />
        </label>
        <label>
          Função
          <select name="role" defaultValue="staff">
            <option value="staff">Staff · operação</option>
            <option value="manager">Manager · gestão operacional</option>
          </select>
        </label>
        <button className="primary-button" type="submit" disabled={pending}>
          {pending ? "Criando convite..." : "Enviar convite"}
        </button>
      </form>

      {state?.error && <p className="form-error">{state.error}</p>}
      {state?.success && (
        <div className="invite-result">
          <strong>{state.success}</strong>
          {state.inviteUrl && (
            <div className="invite-link-row">
              <input value={state.inviteUrl} readOnly />
              <button
                className="secondary-button"
                type="button"
                onClick={() => navigator.clipboard.writeText(state.inviteUrl || "")}
              >
                Copiar link
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
