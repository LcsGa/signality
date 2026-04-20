import { inject, linkedSignal, type CreateSignalOptions, type WritableSignal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, type NavigationExtras, type Params } from '@angular/router';
import { proxySignal, setupContext } from '@signality/core/internal';
import type { WithInjector } from '@signality/core/types';

export type QueryParamsOptions<T extends Params | string> = CreateSignalOptions<T> &
  WithInjector &
  Pick<NavigationExtras, 'replaceUrl'>;

export function queryParams(
  key: string,
  options?: QueryParamsOptions<string>
): WritableSignal<string | null>;

export function queryParams<T extends Params = Params>(
  options?: QueryParamsOptions<T>
): WritableSignal<T>;

/**
 * Reactive wrapper around the [Angular Router](https://angular.dev/guide/routing) query parameters.
 *
 * @param options - Optional configuration including signal options and injector
 * @returns A signal containing the current query parameters
 *
 * @example
 * ```typescript
 * @Component({
 *   template: `
 *     <div>
 *       <p>Search: {{ searchParams().q }}</p>
 *       <p>Sort: {{ searchParams().sort }}</p>
 *     </div>
 *   `
 * })
 * export class SearchParamsDemo {
 *   // Route: /search?q=angular&sort=name
 *   readonly searchParams = queryParams<{ q: string; sort: string }>();
 * }
 * ```
 */
export function queryParams(
  keyOrOptions?: string | QueryParamsOptions<Params> | QueryParamsOptions<string>,
  options?: QueryParamsOptions<Params> | QueryParamsOptions<string>
): WritableSignal<Params | string | null> {
  const { key, options: resolvedOptions } = parseQueryParamsArgs(keyOrOptions, options);
  const { runInContext } = setupContext(resolvedOptions?.injector, queryParams);

  return runInContext(() => {
    const router = inject(Router);
    const { queryParams: paramsChanges, snapshot } = inject(ActivatedRoute);

    const readonlyQueryParams = toSignal(paramsChanges, { initialValue: snapshot.queryParams });

    const queryParams = linkedSignal(() => {
      const params = readonlyQueryParams();
      if (key) return key in params ? (params[key] as string) : null;
      return params;
    });

    return proxySignal(queryParams, {
      set: async (value, source) => {
        const params = key ? { [key]: value as string } : (value as Params);
        const succeeded = await router.navigate([], {
          queryParams: params,
          queryParamsHandling: 'merge',
          preserveFragment: true,
          replaceUrl: resolvedOptions?.replaceUrl,
        });
        if (!succeeded) source.set(value);
      },
    });
  });
}

function parseQueryParamsArgs(
  keyOrOptions?: string | QueryParamsOptions<Params> | QueryParamsOptions<string>,
  options?: QueryParamsOptions<Params> | QueryParamsOptions<string>
) {
  return typeof keyOrOptions === 'string'
    ? { key: keyOrOptions, options }
    : { options: keyOrOptions };
}
