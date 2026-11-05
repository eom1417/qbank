import { z } from 'zod';
import {
  ChannelKeyResponse,
  ChannelListResponse,
  ChannelStats,
  ChannelView,
  type ChannelSettings,
} from '../../../contracts/channels.js';
import { apiRequest } from '../../platform/api/client.js';

/** The owner's publishing channels of a bank (DEC-36). */
export const fetchChannels = (bankId: string) =>
  apiRequest('GET', `/api/banks/${bankId}/channels`, ChannelListResponse);

export const createChannel = (bankId: string, settings: ChannelSettings) =>
  apiRequest('POST', `/api/banks/${bankId}/channels`, ChannelKeyResponse, settings);

export const setPaused = (id: string, paused: boolean) =>
  apiRequest('PATCH', `/api/channels/${id}`, ChannelView, { paused });

export const renewKey = (id: string) =>
  apiRequest('POST', `/api/channels/${id}/key`, ChannelKeyResponse, {});

export const deleteChannel = (id: string) => apiRequest('DELETE', `/api/channels/${id}`, z.null());

export const fetchChannelStats = (id: string) =>
  apiRequest('GET', `/api/channels/${id}/stats`, ChannelStats);
