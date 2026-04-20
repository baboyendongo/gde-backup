import { Component, OnInit } from '@angular/core';
import { RolePermissionService } from '../../services/rolepermission.service';
import { Role } from '../../models/role';
import { User } from '../../models/users';


@Component({
  selector: 'app-role-assignment',
  templateUrl: './role-assignment.html',
  styleUrls: ['./role-assignment.css'],
})
export class RoleAssignmentComponent implements OnInit {
  roles: Role[] = [];
  selectedRolename: string | null = null;
  users: User[] = [];
  selectedUsername: string | null = null;

  constructor(private rolePermissionService: RolePermissionService) {}

  ngOnInit(): void {
    this.loadRoles();
    this.loadUsers();
  }

  loadRoles(): void {
    this.rolePermissionService.getRoles().subscribe({
      next: (roles) => {
        this.roles = roles;
      },
      error: (err) => {
        console.error('Erreur lors du chargement des rôles:', err);
      },
    });
  }

  loadUsers(): void {
    // Assuming there's a method to fetch users, implement accordingly
    // this.userService.getAllUsers().subscribe(...);
  }

  assignRoleToUser(): void {
    if (this.selectedUsername && this.selectedRolename) {
      this.rolePermissionService.assignUserRole(this.selectedUsername, [this.selectedRolename ]).subscribe({
        next: () => {
          alert('Rôle assigné avec succès');
          this.loadUsers(); // Refresh users if needed
        },
        error: (err) => {
          console.error('Erreur lors de l\'assignation du rôle:', err);
          alert('Erreur lors de l\'assignation du rôle');
        },
      });
    } else {
      alert('Veuillez sélectionner un utilisateur et un rôle.');
    }
  }
}