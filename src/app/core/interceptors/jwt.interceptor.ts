import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Router } from '@angular/router';

@Injectable()
export class JwtInterceptor implements HttpInterceptor {

  constructor(private router: Router) {}

  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {

    const url = request.url.toLowerCase();
    const isAuthRequest = url.includes('/authentification') || 
                          url.includes('/api/evolution/authentification') ||
                          url.includes('/login');

    if (isAuthRequest) {
      return next.handle(request);
    }

    const token = localStorage.getItem('auth_token');

    let clonedRequest = request;

    if (token && token.trim().length > 0 && !request.headers.has('Authorization')) {
      clonedRequest = request.clone({
        setHeaders: {
          Authorization: `Bearer ${token.trim()}`
        }
      });
    }
    let jwt : any = token;
    jwt  = JSON.parse(atob(jwt.split('.')[1]));
    const isExpired = jwt.exp < Math.floor(Date.now() / 1000);
    console.log('is expired ::::: ', isExpired);
   localStorage.getItem('auth_token')?.replace('Bearer ', '');
   if (isExpired) {
    localStorage.removeItem('auth_token');
    this.router.navigate(['']);
  }
    return next.handle(clonedRequest);
  }
}