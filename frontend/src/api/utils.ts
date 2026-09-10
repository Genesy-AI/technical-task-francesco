import axios, { AxiosResponse } from 'axios'
import { axiosInstance } from '../utils/axios'

export const MAX_UPLOAD_FILE_SIZE = 2 * 1024 * 1024

export function endpoint<Output>(
  method: 'get' | 'delete' | 'post' | 'put' | 'patch',
  path: string
): () => Promise<Output>
export function endpoint<Output, Input extends undefined>(
  method: 'get' | 'delete' | 'post' | 'put' | 'patch',
  path: string
): (...args: Exclude<Input, undefined> extends never ? [] : [Input]) => Promise<Output>
export function endpoint<Output, Input>(
  method: 'get' | 'delete' | 'post' | 'put' | 'patch',
  path: string
): (body: Input) => Promise<Output>
export function endpoint<Output, Input>(
  method: 'get' | 'delete' | 'post' | 'put' | 'patch',
  pathBuilder: (q: Input) => string
): (body: Input) => Promise<Output>
export function endpoint<Output, Input>(
  method: 'get' | 'delete' | 'post' | 'put' | 'patch',
  urlBuilder: string | ((q: Input) => string)
): (body?: Input) => Promise<Output> {
  return async (body?: Input) => {
    const url = `${typeof urlBuilder === 'string' ? urlBuilder : urlBuilder(body!)}`

    let res: AxiosResponse
    if (method === 'get') {
      res = await axiosInstance[method](url, { params: body })
    } else {
      res = await axiosInstance.request({
        method,
        url,
        data: body,
      })
    }

    return res.data as Output
  }
}

/**
 * Turns whatever a failed request threw into something worth showing a user. Lives here so
 * callers do not have to know the HTTP client, or the shape its errors come in.
 */
export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      return 'The request timed out. It may still be running in the background, refresh in a moment to see the result.'
    }

    const data: unknown = error.response?.data
    if (data && typeof data === 'object' && 'error' in data && typeof data.error === 'string') {
      return data.error
    }
  }

  if (error instanceof Error && error.message) return error.message

  return fallback
}

export type ApiModule = {
  readonly [key: string]: ((...args: any[]) => Promise<any>) | ApiModule
}

export type ApiInput<T extends (...args: any[]) => Promise<any>> = Parameters<T>[0]
export type ApiOutput<T extends (...args: any[]) => Promise<any>> = Awaited<ReturnType<T>>
