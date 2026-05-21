#!/usr/bin/env python3
import sys
import paramiko

def run_ssh_command(command):
    host = "100.111.96.72"  # IP de Tailscale de Debian
    user = "trok"
    password = "trok"
    
    print(f"[*] Conectando a {host} por SSH como '{user}'...")
    
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        ssh.connect(host, username=user, password=password, timeout=10)
        print("[+] Conexión establecida con éxito!")
        print(f"[*] Ejecutando: {command}")
        
        stdin, stdout, stderr = ssh.exec_command(command)
        
        out_content = stdout.read().decode('utf-8', errors='replace')
        err_content = stderr.read().decode('utf-8', errors='replace')
        
        if out_content:
            print("\n--- SALIDA ---")
            print(out_content.strip())
            
        if err_content:
            print("\n--- ERRORES ---")
            print(err_content.strip())
            
        ssh.close()
    except Exception as e:
        print(f"[-] Error de conexión o ejecución: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Uso: python ssh_debian.py <comando_a_ejecutar>")
        print("Ejemplo: python ssh_debian.py \"uname -a\"")
        sys.exit(1)
        
    cmd = " ".join(sys.argv[1:])
    run_ssh_command(cmd)
