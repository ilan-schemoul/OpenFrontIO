import { LitElement, html } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { v4 as uuidv4 } from 'uuid';
import { MAX_USERNAME_LENGTH, validateUsername } from '../core/validations/username';

const usernameKey: string = 'username';

@customElement('username-input')
export class UsernameInput extends LitElement {
    @state() private username: string = '';
    @property({ type: String }) validationError: string = '';
    private _isValid: boolean = true;

    // Remove static styles since we're using Tailwind

    createRenderRoot() {
        // Disable shadow DOM to allow Tailwind classes to work
        return this;
    }

    public getCurrentUsername(): string {
        return this.username;
    }

    connectedCallback() {
        super.connectedCallback();
        this.username = this.getStoredUsername();
        this.dispatchUsernameEvent();
    }

    render() {
        return html`
            <input 
                type="text" 
                .value=${this.username}
                @input=${this.handleChange}
                @change=${this.handleChange}
                placeholder="Enter your username"
                maxlength="${MAX_USERNAME_LENGTH}"
                class="w-full px-4 py-2 bg-white border border-gray-300 rounded-xl shadow-sm text-2xl text-gray-900 text-center focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
            ${this.validationError
                ? html`<div class="mt-2 px-3 py-1 text-lg text-red-600 bg-white border border-red-600 rounded">${this.validationError}</div>`
                : null}
        `;
    }

    private handleChange(e: Event) {
        const input = e.target as HTMLInputElement;
        this.username = input.value.trim();
        const result = validateUsername(this.username)
        this._isValid = result.isValid
        if (result.isValid) {
            this.storeUsername(this.username);
            this.validationError = ''
        } else {
            this.validationError = result.error
        }
    }

    private getStoredUsername(): string {
        const storedUsername = localStorage.getItem(usernameKey);
        if (storedUsername) {
            return storedUsername;
        }
        return this.generateNewUsername();
    }

    private storeUsername(username: string) {
        if (username) {
            localStorage.setItem(usernameKey, username);
        }
    }

    private dispatchUsernameEvent() {
        this.dispatchEvent(new CustomEvent('username-change', {
            detail: { username: this.username },
            bubbles: true,
            composed: true
        }));
    }

    private generateNewUsername(): string {
        const newUsername = "Anon" + this.uuidToThreeDigits();
        this.storeUsername(newUsername);
        return newUsername;
    }

    private uuidToThreeDigits(): string {
        const uuid = uuidv4();
        const cleanUuid = uuid.replace(/-/g, '').toLowerCase();
        const decimal = BigInt(`0x${cleanUuid}`);
        const threeDigits = decimal % 1000n;
        return threeDigits.toString().padStart(3, '0');
    }

    public isValid(): boolean {
        return this._isValid;
    }
}