import { Routes } from '@angular/router';
import { LoginComponent } from './components/login/login';
import { RegistroComponent } from './components/registro/registro';
import { DashboardComponent } from './components/dashboard/dashboard';
import { PerfilComponent } from './components/perfil/perfil';
import { authGuard } from './guards/auth-guard';
import { UsuariosComponent } from './components/usuarios/usuarios';
import { SalasComponent } from './components/salas/salas'; 

export const routes: Routes = [
    { path: 'login', component: LoginComponent },
    { path: 'registro', component: RegistroComponent },
    { path: 'perfil', component: PerfilComponent, canActivate: [authGuard] },
    { path: 'usuarios', component: UsuariosComponent, canActivate: [authGuard] },
    
    { 
        path: 'dashboard', 
        component: DashboardComponent, 
        canActivate: [authGuard],
        children: [
            { path: 'salas/:id', component: SalasComponent }
        ]
    },
    
    { path: '', redirectTo: '/login', pathMatch: 'full' },
    { path: '**', redirectTo: '/login' }
];