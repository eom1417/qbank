import { createContext, useContext } from 'react';
import type { ProviderAccessResponse } from '../../../contracts/providers.js';

/** Local install: the owner signs in and runs the machine too (DEC-31). */
const LOCAL: ProviderAccessResponse = { signIn: true, operator: true };

/** What this account may do with its AI (DEC-35); the providers screen provides it. */
export const ProviderAccessContext = createContext<ProviderAccessResponse>(LOCAL);

export const useProviderAccess = () => useContext(ProviderAccessContext);
