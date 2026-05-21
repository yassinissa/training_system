// Minimal placeholder to avoid 404s; enhance as needed.
(function() {
  function fieldRow(name) {
    // Prefer modern Django admin markup: .form-row.field-<name>
    var row = document.querySelector('.form-row.field-' + name);
    if (row) return row;
    // Fallback: find by input id and walk up
    var input = document.getElementById('id_' + name) || document.getElementById('id_' + name + '_from');
    var node = input;
    while (node && node !== document) {
      if (node.classList && node.classList.contains('form-row')) return node;
      node = node.parentElement;
    }
    return null;
  }

  function show(row, makeVisible) {
    if (!row) return;
    row.style.display = makeVisible ? '' : 'none';
  }

  function toggleByRole(role) {
    var employeeNumber = fieldRow('employee_number');
    var position = fieldRow('position');
    var employeeBranch = fieldRow('employee_branch');
    var managerBranches = fieldRow('manager_branches');

    if (role === 'ADMIN') {
      show(employeeNumber, false);
      show(position, false);
      show(employeeBranch, false);
      show(managerBranches, false);
    } else if (role === 'MANAGER') {
      show(employeeNumber, true);
      show(position, true);
      show(employeeBranch, false);
      show(managerBranches, true);
    } else if (role === 'EMPLOYEE') {
      show(employeeNumber, true);
      show(position, true);
      show(employeeBranch, true);
      show(managerBranches, false);
    }
  }

  document.addEventListener('DOMContentLoaded', function() {
    var roleSelect = document.getElementById('id_role');
    if (!roleSelect) return;
    var apply = function() { toggleByRole(roleSelect.value); };
    roleSelect.addEventListener('change', apply);
    apply();
  });
})();
