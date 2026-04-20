import { inject, linkedSignal, type CreateSignalOptions, type WritableSignal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, type NavigationExtras, type Params } from '@angular/router';
import { proxySignal, setupContext } from '@signality/core/internal';
import type { WithInjector } from '@signality/core/types';

export type QueryParamsTransform<T extends Params | (string | null), R = T> = {
  get?: (value: T | null) => R;
  set?: (value: R) => T | null;
};

export type QueryParamsOptions<T extends Params | (string | null)> = CreateSignalOptions<T> &
  WithInjector &
  Pick<NavigationExtras, 'replaceUrl'> & {
    transform?: QueryParamsTransform<T>['get'] | QueryParamsTransform<T>;
  };

export function queryParams<T extends string | null>(
  key: string,
  options?: QueryParamsOptions<T>
): WritableSignal<T>;

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
  keyOrOptions?: string | QueryParamsOptions<Params | (string | null)>,
  options?: QueryParamsOptions<Params | (string | null)>
): WritableSignal<Params | (string | null)> {
  const { key, options: resolvedOptions } = parseQueryParamsArgs(keyOrOptions, options);
  const { runInContext } = setupContext(resolvedOptions?.injector, queryParams);

  return runInContext(() => {
    const router = inject(Router);
    const { queryParams: paramsChanges, snapshot } = inject(ActivatedRoute);

    const { get, set } = parseTransform(resolvedOptions?.transform);

    const readonlyQueryParams = toSignal(paramsChanges, { initialValue: snapshot.queryParams });
    const queryParams = linkedSignal(() => {
      const params = readonlyQueryParams();
      if (key) return key in params ? (params[key] as string) : null;
      return params;
    });

    return proxySignal(queryParams, {
      get: source => get(source()),
      set: async (value, source) => {
        const params = key ? { [key]: set(value) as string } : (set(value) as Params);
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
  keyOrOptions?: string | QueryParamsOptions<Params | (string | null)>,
  options?: QueryParamsOptions<Params | (string | null)>
) {
  return typeof keyOrOptions === 'string'
    ? { key: keyOrOptions, options }
    : { options: keyOrOptions };
}

function parseTransform<T extends Params | (string | null), R = T>(
  transform?: QueryParamsOptions<T>['transform']
) {
  const identityGet = ((v: any) => v) as Required<QueryParamsTransform<T, R>>['get'];
  const identitySet = ((v: any) => v) as Required<QueryParamsTransform<T, R>>['set'];
  if (typeof transform === 'function') return { get: transform, set: identitySet };
  else if (transform) {
    return { get: transform.get ?? identityGet, set: transform.set ?? identitySet };
  } else return { get: identityGet, set: identitySet };
}
