export function from_cal(data) {
    // ส่วนของการประมวลผล
    const base_commit_one = data[0].base_commit_one;
    const base_commit_two = data[0].base_commit_two;
    let total_cash = 0;
    let transfer_amount = 0;
    let transfer_amount_user = 0;
    let expenses = 0;
    const worktime1 = data.filter(item => item.worktime === 1).length; /// กรุงเทพ
    const worktime2 = data.filter(item => item.worktime === 2).length; /// พัทยา
    const id_bill = data[0].id_bill + ".1";
    for (let index = 0; index < data.length; index++) {
        total_cash += data[index].total_cash;
        transfer_amount += data[index].total_transfer;
        transfer_amount_user += data[index].total_transfer_user;
        expenses += data[index].total_expenses;
    }
    const total = parseInt(total_cash) + parseInt(transfer_amount);
    const tip = transfer_amount_user - transfer_amount;
    let sum_icom = 0;
    let commision = "";
    let percencom = 0;
    if (worktime1 === 0 && worktime2 > 0) { ///ถ้าไม่มีวิ่งในกรุงเทพ ///วิ่งพัทยาล้วน
        // console.log("พัทยาล้วน");
        percencom = base_commit_two * data.length;
    } else if (worktime2 === 0 && worktime1 > 0) { ///ถ้าไม่มีวิ่งในพัทยา ///วิ่งกรุงเทพล้วน
        // console.log("กรุงเทพล้วน");
        percencom = base_commit_one * data.length;
    } else if (worktime1 > 0 && worktime2 > 0) { ///วิ่งผสม 
        // console.log("วิ่งผสม");
        percencom = base_commit_one * worktime1 + base_commit_two * worktime2;
    }
    if (total >= (percencom * 0.5)) {
        sum_icom = total * 0.5;
        commision = " 0.5 หรือ 50%";
    } else if (total >= (percencom * 0.4)) {
        sum_icom = total * 0.4;
        commision = " 0.4 หรือ 40%";
    } else if (total >= (percencom * 0.3)) {
        sum_icom = total * 0.3;
        commision = " 0.3 หรือ 30%";
    } else if (total >= (percencom * 0.2)) {
        sum_icom = total * 0.2;
        commision = " 0.2 หรือ 20%";
    } else if (total >= (percencom * 0.1)) {
        sum_icom = total * 0.1;
        commision = " 0.1 หรือ 10%";
    } else {
        sum_icom = 0;
        commision = "ไม่ได้รับค่าคอมมิชชั่น";
    }

    const gross_income = sum_icom + tip;
    const net = total - expenses;
    const net_cut = net - transfer_amount;
    // ส่วนของการคืนค่า
    return { total_cash, transfer_amount, transfer_amount_user, expenses, total, commision, tip, sum_icom, gross_income, net, net_cut, id_bill, base_commit_one, base_commit_two };
}